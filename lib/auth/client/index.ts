import { createAuthClient } from "better-auth/client";
import { electronClient } from "@better-auth/electron/client";
import { authUrl, oauthClientId } from "@/utils/environment";
import { getLoginSignInURL, type LoginBrowser } from "@/lib/auth/login-browser";
import { nativeStorage } from "@/lib/auth/storage";
import { desktopFetch } from "@/lib/http/transport";

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

export function createDesktopAuthClient(browser: LoginBrowser = "default") {
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
type DesktopAuthClient = ReturnType<typeof createDesktopAuthClient>;
let client: DesktopAuthClient | undefined;

export const authClient = new Proxy({} as DesktopAuthClient, {
  get(_target, key) {
    return Reflect.get((client ??= createDesktopAuthClient()), key);
  },
});
