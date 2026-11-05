import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createAuthPolicy } from "@gorth-io/structure/modules/auth/client";
import { prepareAuthProtocol } from "@/main/services/auth-protocol";

const sdk = vi.hoisted(() => ({
  requestAuth: vi.fn(),
  authenticate: vi.fn(),
  getSession: vi.fn(),
}));
vi.mock("better-auth/client", () => ({ createAuthClient: () => sdk }));
vi.mock("@better-auth/electron/client", () => ({ electronClient: vi.fn() }));
vi.mock("@/lib/auth/login-browser", () => ({
  getLoginBrowser: () => "default",
  getLoginSignInURL: (origin: string) => new URL("/auth/desktop", origin).href,
}));
vi.mock("@/main/services/auth-protocol", () => ({
  prepareAuthProtocol: vi.fn(async () => {}),
}));
vi.mock("electron", () => ({
  app: {},
  protocol: {},
  BrowserWindow: { getAllWindows: () => [] },
}));
vi.mock("@/utils/environment", () => ({
  authUrl: "https://app.example.test",
  oauthClientId: "gorth-launcher",
}));
vi.mock("@/lib/auth/storage", () => ({
  nativeStorage: { getItem: vi.fn() },
  nativeVaultExists: () => false,
  clearNativeSessionStorage: vi.fn(),
  requireSecureStorage: vi.fn(),
}));

const pkceKey = Symbol.for("better-auth:electron");
const pkce = new Map<string, string>();

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(1000);
  pkce.clear();
  Object.defineProperty(globalThis, pkceKey, {
    value: pkce,
    configurable: true,
  });
  sdk.requestAuth.mockImplementation(async () => {
    pkce.set("sdk-state", "sdk-verifier");
  });
});
afterEach(() => {
  pkce.clear();
  Reflect.deleteProperty(globalThis, pkceKey);
  vi.useRealTimers();
});

it("expires official SDK login at the shared 120-second deadline and rejects late callbacks", async () => {
  const native = await import("@/lib/auth/gorth");
  const login = native.loginGorth(new AbortController().signal);
  const result = expect(login).rejects.toThrow("Sign-in timed out.");
  const deadline = createAuthPolicy().transactionMaxAgeMs;
  expect(deadline).toBe(120_000);
  await vi.advanceTimersByTimeAsync(deadline - 1);
  expect(pkce.size).toBe(1);
  await vi.advanceTimersByTimeAsync(1);
  await result;
  expect(pkce.size).toBe(0);
  expect(
    await native.receiveGorthDeepLink(
      native.authScheme + "://auth/callback#token=late",
    ),
  ).toBe(false);
  expect(sdk.authenticate).not.toHaveBeenCalled();
});

it("does not open the browser if the OS callback handler cannot be registered", async () => {
  vi.mocked(prepareAuthProtocol).mockRejectedValueOnce(
    new Error("OS handler unavailable"),
  );
  const native = await import("@/lib/auth/gorth");
  await expect(native.loginGorth(new AbortController().signal)).rejects.toThrow(
    "desktop callback",
  );
  expect(sdk.requestAuth).not.toHaveBeenCalled();
});

it("does not open the browser after cancellation while registering the callback", async () => {
  let complete!: () => void;
  vi.mocked(prepareAuthProtocol).mockReturnValueOnce(
    new Promise<void>((resolve) => {
      complete = resolve;
    }),
  );
  const native = await import("@/lib/auth/gorth");
  const controller = new AbortController();
  const login = native.loginGorth(controller.signal);
  const rejected = expect(login).rejects.toThrow("cancelled");
  controller.abort();
  await rejected;
  complete();
  await vi.advanceTimersByTimeAsync(0);
  expect(sdk.requestAuth).not.toHaveBeenCalled();
});

it("cancels SDK login and permits another attempt without reviving cancelled state", async () => {
  const native = await import("@/lib/auth/gorth");
  const controller = new AbortController();
  const login = native.loginGorth(controller.signal);
  const cancelled = expect(login).rejects.toThrow("Sign-in cancelled.");
  await vi.advanceTimersByTimeAsync(0);
  controller.abort();
  await cancelled;
  expect(pkce.size).toBe(0);
  const next = new AbortController();
  const retry = native.loginGorth(next.signal);
  const retryCancelled = expect(retry).rejects.toThrow("Sign-in cancelled.");
  await vi.advanceTimersByTimeAsync(0);
  expect(sdk.requestAuth).toHaveBeenCalledTimes(2);
  next.abort();
  await retryCancelled;
  expect(pkce.size).toBe(0);
});

it("uses the shared identity freshness limit without replacing native session checks", async () => {
  sdk.getSession.mockResolvedValue({
    data: {
      user: {
        externalUserId: "sso-subject",
        name: "Account",
        email: "account@example.test",
        emailVerified: true,
      },
      session: { expiresAt: new Date(1_000_000).toISOString() },
    },
  });
  const native = await import("@/lib/auth/gorth");
  await native.restoreGorthSession();
  expect(native.getGorthUserId()).toBe("sso-subject");
  await vi.advanceTimersByTimeAsync(createAuthPolicy().identityMaxAgeMs);
  expect(native.getGorthUserId()).toBeNull();
  expect(sdk.getSession).toHaveBeenCalledWith({
    query: { disableCookieCache: true },
    fetchOptions: { signal: undefined },
  });
});
