import { createAuthClient } from "better-auth/client";
import { electronClient } from "@better-auth/electron/client";
import { createAuthPolicy } from "@gorth-io/structure/modules/auth/client";
import { app, BrowserWindow, protocol } from "electron";
import { authUrl, oauthClientId } from "@/utils/environment";
import { prepareAuthProtocol } from "@/main/services/auth-protocol";
import {
  getLoginBrowser,
  getLoginSignInURL,
  type LoginBrowser,
} from "@/lib/auth/login-browser";
import {
  nativeStorage,
  nativeVaultExists,
  clearNativeSessionStorage,
  requireSecureStorage,
} from "@/lib/auth/storage";
import type { NativeIdentity } from "@/lib/auth/native-types";

const authPolicy = createAuthPolicy();

export const authScheme = "com.gorth.launcher";
export function gorthConfigured() {
  if (!authUrl || oauthClientId !== "gorth-launcher") return false;
  try {
    const url = new URL(authUrl);
    return (
      url.pathname === "/" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      (url.protocol === "https:" ||
        (url.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
    );
  } catch {
    return false;
  }
}
let client: ReturnType<typeof createClient> | undefined;
let identity: NativeIdentity | null = null;
let verifiedAt = 0;
let unlocked = false;
let pending: {
  signal: AbortSignal;
  exchanging: boolean;
  complete: () => void;
  fail: () => void;
} | null = null;
let revision = 0;
let opening: Promise<void> | undefined;
// SDK 1.7.7 advertises kElectron in its declarations but omits the runtime
// export. Its shared PKCE map is cleared only to fence cancelled requests.
const sdkPkceKey = Symbol.for("better-auth:electron");
let installed = false;
const listeners = new Set<() => void>();
function notify() {
  for (const listener of listeners) listener();
}

function createClient(browser: LoginBrowser = "default") {
  if (!gorthConfigured())
    throw new Error("Desktop auth configuration is incomplete.");
  const origin = new URL(authUrl);
  if (
    origin.pathname !== "/" ||
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    (origin.protocol !== "https:" &&
      !(
        origin.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)
      ))
  )
    throw new Error("Invalid desktop auth origin.");
  return createAuthClient({
    baseURL: origin.origin,
    basePath: "/auth",
    fetchOptions: { timeout: 10_000, retry: 0, customFetchImpl: desktopFetch },
    plugins: [
      electronClient({
        clientID: oauthClientId,
        signInURL: getLoginSignInURL(origin.origin, browser),
        protocol: { scheme: authScheme },
        callbackPath: "/auth/callback",
        storage: nativeStorage,
        storagePrefix: "gorth-native",
        cookiePrefix: "gorth",
        userImageProxy: { enabled: false },
        disableCache: true,
      }),
    ],
  });
}
export function getGorthClient() {
  return (client ??= createClient());
}
export function onGorthChanged(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function gorthSnapshot() {
  return {
    user: identity
      ? {
          ...identity,
          verifiedAt,
          canRefresh: true,
          needsLogin: identity.expiresAt <= Date.now(),
        }
      : null,
    locked: !unlocked && nativeVaultExists(),
    configured: gorthConfigured(),
  };
}
export function getGorthUserId() {
  return identity &&
    identity.expiresAt > Date.now() &&
    Date.now() - verifiedAt < authPolicy.identityMaxAgeMs
    ? identity.id
    : null;
}
export async function restoreGorthSession(signal?: AbortSignal) {
  requireSecureStorage();
  // Validate the file before the SDK's storage adapter (which catches errors).
  nativeStorage.getItem("gorth-native.cookie");
  unlocked = true;
  const version = revision;
  const result = await getGorthClient().getSession({
    query: { disableCookieCache: true },
    fetchOptions: { signal },
  });
  signal?.throwIfAborted();
  if (version !== revision) return;
  if (result.error)
    throw new Error("Could not verify the app session. Please try again.");
  if (!result.data) identity = null;
  else {
    const user = result.data.user as typeof result.data.user & {
      externalUserId?: unknown;
      username?: unknown;
    };
    if (typeof user.externalUserId !== "string" || !user.externalUserId)
      throw new Error("The app session is not bound to a Gorth SSO identity.");
    identity = {
      id: user.externalUserId,
      name: user.name,
      email: user.email,
      image: user.image ?? undefined,
      username: typeof user.username === "string" ? user.username : undefined,
      emailVerified: user.emailVerified,
      expiresAt: new Date(result.data.session.expiresAt).getTime(),
    };
  }
  verifiedAt = Date.now();
  notify();
}
export async function signOutGorth() {
  revision++;
  identity = null;
  verifiedAt = 0;
  notify(); // Block local API access before the remote sign-out.
  try {
    requireSecureStorage();
    const result = await getGorthClient().signOut();
    if (result.error)
      throw new Error(
        "Signed out locally. Remote app-session deletion could not be confirmed.",
      );
  } finally {
    clearNativeSessionStorage();
    unlocked = true;
  }
}
export async function receiveGorthDeepLink(url: string) {
  const request = pending;
  if (!request || request.signal.aborted || request.exchanging) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (
    parsed.protocol !== authScheme + ":" ||
    "/" + parsed.hostname + parsed.pathname !== "/auth/callback" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    !parsed.hash.startsWith("#token=") ||
    parsed.hash.length > 4096
  )
    return false;
  request.exchanging = true;
  try {
    const result = await getGorthClient().authenticate({
      token: parsed.hash.slice(7),
      fetchOptions: { signal: request.signal },
    });
    if (result.error) throw new Error("Desktop sign-in was rejected.");
    try {
      await restoreGorthSession(request.signal);
      if (!getGorthUserId())
        throw new Error("App session verification failed.");
    } catch (error) {
      identity = null;
      verifiedAt = 0;
      notify();
      throw error;
    }
    request.complete();
    const owner = BrowserWindow.getAllWindows()[0];
    if (owner && !owner.isDestroyed()) {
      if (owner.isMinimized()) owner.restore();
      owner.show();
      owner.focus();
    }
  } catch {
    request.fail();
  }
  return true;
}
export function installGorthAuth() {
  if (installed) return;
  installed = true;
  protocol.registerSchemesAsPrivileged([
    { scheme: authScheme, privileges: { secure: true } },
  ]);
  if (!gorthConfigured()) return;
  // Preserve the app's existing CSP and single-instance ownership. SDK default
  // IPC bridges have no sender checks, so use the app's narrower trusted bridge.
  getGorthClient().setupMain({
    scheme: false,
    csp: false,
    bridges: false,
    getWindow: () => BrowserWindow.getAllWindows()[0],
  });
  app.on("open-url", (event, url) => {
    event.preventDefault();
    void receiveGorthDeepLink(url);
  });
  app.on("second-instance", (_event, argv) => {
    const url = argv.find((value) => value.startsWith(authScheme + ":"));
    if (url) void receiveGorthDeepLink(url);
  });
}
export async function loginGorth(signal: AbortSignal) {
  requireSecureStorage();
  if (opening) await opening;
  if (signal.aborted) throw new Error("Sign-in cancelled.");
  if (pending) throw new Error("An account operation is already running.");
  revision++;
  await new Promise<void>((resolve, reject) => {
    const controller = new AbortController();
    const attemptSignal = AbortSignal.any([signal, controller.signal]);
    let settled = false;
    const abort = () => finish(new Error("Sign-in cancelled."));
    const timer = setTimeout(
      () => finish(new Error("Sign-in timed out.")),
      authPolicy.transactionMaxAgeMs,
    );
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      pending = null;
      // Clear the official SDK's outstanding PKCE requests after completion,
      // timeout or cancellation; no custom OAuth state/verifier implementation.
      const cache = (
        globalThis as typeof globalThis & { [sdkPkceKey]?: Map<string, string> }
      )[sdkPkceKey];
      cache?.clear();
      if (error) {
        revision++;
        controller.abort();
        reject(error);
      } else resolve();
    };
    pending = {
      signal: attemptSignal,
      exchanging: false,
      complete: () => finish(),
      fail: () => finish(new Error("Sign-in failed.")),
    };
    signal.addEventListener("abort", abort, { once: true });
    async function start() {
      try {
        await prepareAuthProtocol(authScheme, receiveGorthDeepLink);
        if (attemptSignal.aborted || settled) return;
        // Both clients use the official SDK's shared pending PKCE state. Only
        // signInURL changes; authenticate/session storage stay on the main client.
        const requester =
          getLoginBrowser() === "gorth"
            ? createClient("gorth")
            : getGorthClient();
        await requester.requestAuth();
        if (signal.aborted || settled) {
          const cache = (
            globalThis as typeof globalThis & {
              [sdkPkceKey]?: Map<string, string>;
            }
          )[sdkPkceKey];
          cache?.clear();
        }
      } catch {
        finish(
          new Error(
            "Could not prepare the desktop callback or open the selected login browser.",
          ),
        );
      }
    }
    opening = start();
  });
  signal.throwIfAborted();
}
import { desktopFetch } from "@/lib/http/transport";
