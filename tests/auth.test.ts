import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { betterAuth } from "better-auth";
import { electron } from "@better-auth/electron";
import { calls, shell, directory } from "./electron-auth-mock";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { setLoginBrowser } from "@/lib/auth/login-browser";
vi.mock("electron", () => import("./electron-auth-mock"));
vi.mock("@/main/services/auth-protocol", () => ({
  prepareAuthProtocol: vi.fn(async () => {}),
}));
vi.mock("@/utils/environment", () => ({
  authUrl: "http://localhost:5503",
  oauthClientId: "gorth-launcher",
}));

beforeEach(() => {
  Object.defineProperty(process, "type", {
    value: "browser",
    configurable: true,
  });
  calls.available = true;
});
afterEach(() => {
  setLoginBrowser("default");
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("uses official SDK PKCE transfer, restores the SSO identity, switches accounts and signs out only from the app", async () => {
  const auth = betterAuth({
    baseURL: "http://localhost:5503",
    basePath: "/auth",
    secret: "isolated-fixture-secret-at-least-32-bytes",
    logger: { disabled: true },
    rateLimit: { enabled: false },
    trustedOrigins: ["http://localhost:5503", "com.gorth.launcher:/"],
    plugins: [
      electron({
        clientID: "gorth-launcher",
        cookiePrefix: "gorth",
        codeExpiresIn: 120,
      }),
    ],
    user: {
      additionalFields: { externalUserId: { type: "string", required: true } },
    },
    advanced: { cookiePrefix: "gorth" },
  });
  const context = await auth.$context;
  const users = await Promise.all(
    ["subject-one", "subject-two"].map((sub) =>
      context.internalAdapter.createUser(
        {
          name: sub,
          email: sub + "@example.test",
          emailVerified: true,
          externalUserId: sub,
        },
        { method: "oauth", oauth: { providerId: "gorth", profile: { sub } } },
      ),
    ),
  );
  const urls: string[] = [];
  vi.spyOn(shell, "openExternal").mockImplementation(async (url: string) => {
    urls.push(url);
  });
  const paths: string[] = [];
  vi.stubGlobal(
    "fetch",
    async (input: Request | string | URL, init?: RequestInit) => {
      const request =
        input instanceof Request ? input : new Request(input, init);
      paths.push(new URL(request.url).pathname);
      return auth.handler(request);
    },
  );
  const native = await import("@/lib/auth/gorth");
  for (const user of users) {
    setLoginBrowser(users.indexOf(user) === 0 ? "default" : "gorth");
    const controller = new AbortController();
    const login = native.loginGorth(controller.signal);
    await vi.waitFor(() => expect(urls.length).toBe(users.indexOf(user) + 1));
    const query = new URL(urls.at(-1)!).searchParams;
    expect(new URL(urls.at(-1)!).protocol).toBe(
      users.indexOf(user) === 0 ? "http:" : "com.gorth.browser:",
    );
    expect(query.get("client_id")).toBe("gorth-launcher");
    expect(query.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const identifier = "fixture-" + user.id;
    // Native Electron 1.7.17 binds the transfer to an active browser session.
    const sourceSession = await context.internalAdapter.createSession(user.id);
    await context.internalAdapter.createVerificationValue({
      identifier: "electron:" + identifier,
      value: JSON.stringify({
        state: query.get("state"),
        codeChallenge: query.get("code_challenge"),
        sourceSessionTokenHash: createHash("sha256")
          .update(sourceSession.token)
          .digest("base64url"),
        userId: user.id,
      }),
      expiresAt: new Date(Date.now() + 120_000),
    });
    const token = Buffer.from(
      JSON.stringify({ identifier, state: query.get("state") }),
    ).toString("base64url");
    expect(
      await native.receiveGorthDeepLink(
        "com.gorth.launcher://auth/callback#token=" + token,
      ),
    ).toBe(true);
    await login;
    expect(native.getGorthUserId()).toBe(user.externalUserId);
    expect(JSON.stringify(native.gorthSnapshot())).not.toMatch(
      /session_token|fixture-.*token|code_verifier/,
    );
    await native.restoreGorthSession();
    expect(native.gorthSnapshot().user?.id).toBe(user.externalUserId);
  }
  const { authClient } = await import("@/lib/auth/client/index");
  const cookie = authClient.getCookie();
  expect(cookie).toContain("session_token");
  await native.signOutGorth();
  expect(native.gorthSnapshot().user).toBeNull();
  expect(authClient.getCookie()).toBe("");
  expect(paths.filter((path) => path.includes("sign-out"))).toEqual([
    "/auth/sign-out",
  ]);
  const response = await auth.handler(
    new Request(
      "http://localhost:5503/auth/get-session?disableCookieCache=true",
      { headers: { Cookie: cookie } },
    ),
  );
  expect(await response.json()).toBeNull();
});

it("ignores foreign callbacks, cancels and expires pending SDK state at 120 seconds", async () => {
  vi.useFakeTimers();
  vi.spyOn(shell, "openExternal").mockResolvedValue(undefined);
  const native = await import("@/lib/auth/gorth");
  const first = new AbortController();
  const cancelled = native.loginGorth(first.signal);
  const checkCancelled = expect(cancelled).rejects.toThrow("cancelled");
  await vi.advanceTimersByTimeAsync(0);
  expect(
    await native.receiveGorthDeepLink(
      "https://foreign.test/auth/callback#token=bad",
    ),
  ).toBe(false);
  first.abort();
  await checkCancelled;
  const timedOut = native.loginGorth(new AbortController().signal);
  const checkTimeout = expect(timedOut).rejects.toThrow("timed out");
  await vi.advanceTimersByTimeAsync(120_000);
  await checkTimeout;
  const again = new AbortController();
  const retry = native.loginGorth(again.signal);
  const checkRetry = expect(retry).rejects.toThrow("cancelled");
  again.abort();
  await checkRetry;
});

it("discards the saved native credential even when the OS keychain is locked during logout", async () => {
  const native = await import("@/lib/auth/gorth");
  calls.available = false;
  await expect(native.signOutGorth()).rejects.toThrow("keychain");
  expect(native.getGorthUserId()).toBeNull();
  expect(
    JSON.parse(
      await readFile(path.join(directory, "better-auth.v1.json"), "utf8"),
    ),
  ).toEqual({});
});
