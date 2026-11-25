import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createAuthPolicy } from "@gorth-com/structure/modules/auth/client";
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

function callback(scheme: string, state: string) {
  return (
    scheme +
    "://auth/callback#token=" +
    Buffer.from(JSON.stringify({ state, identifier: "transfer" })).toString(
      "base64url",
    )
  );
}

it("ignores a cancelled callback while a newer SDK login remains usable", async () => {
  sdk.requestAuth
    .mockImplementationOnce(async () => {
      pkce.set("old", "old-verifier");
    })
    .mockImplementationOnce(async () => {
      pkce.set("new", "new-verifier");
    });
  sdk.authenticate.mockImplementation(async () => {
    pkce.delete("new");
    return { data: {} };
  });
  sdk.getSession.mockResolvedValue({
    data: {
      user: {
        externalUserId: "new-user",
        name: "New",
        email: "new@example.test",
      },
      session: { expiresAt: new Date(1_000_000).toISOString() },
    },
  });
  const native = await import("@/lib/auth/gorth");
  const first = new AbortController();
  const firstResult = expect(native.loginGorth(first.signal)).rejects.toThrow(
    "cancelled",
  );
  await vi.advanceTimersByTimeAsync(0);
  first.abort();
  await firstResult;
  const second = native.loginGorth(new AbortController().signal);
  await vi.advanceTimersByTimeAsync(0);
  for (const token of [
    "bad",
    "%invalid",
    Buffer.from("null").toString("base64url"),
  ])
    expect(
      await native.receiveGorthDeepLink(
        native.authScheme + "://auth/callback#token=" + token,
      ),
    ).toBe(false);
  expect(
    await native.receiveGorthDeepLink(callback(native.authScheme, "old")),
  ).toBe(false);
  expect(sdk.authenticate).not.toHaveBeenCalled();
  expect(
    await native.receiveGorthDeepLink(callback(native.authScheme, "new")),
  ).toBe(true);
  await second;
  expect(native.getGorthUserId()).toBe("new-user");
  expect(sdk.authenticate).toHaveBeenCalledTimes(1);
});

it("cancels a retry immediately even while the previous browser opener is unresolved", async () => {
  let release!: () => void;
  sdk.requestAuth.mockImplementationOnce(async () => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    pkce.set("late-created", "late-verifier");
  });
  const native = await import("@/lib/auth/gorth");
  const first = new AbortController();
  const cancelled = expect(native.loginGorth(first.signal)).rejects.toThrow(
    "cancelled",
  );
  await vi.advanceTimersByTimeAsync(0);
  first.abort();
  await cancelled;
  const retry = new AbortController();
  const retryCancelled = expect(
    native.loginGorth(retry.signal),
  ).rejects.toThrow("cancelled");
  await vi.advanceTimersByTimeAsync(0);
  retry.abort();
  await retryCancelled; // Must settle without releasing the old shell call.
  const third = new AbortController();
  const thirdCancelled = expect(
    native.loginGorth(third.signal),
  ).rejects.toThrow("cancelled");
  await vi.advanceTimersByTimeAsync(0);
  release();
  await vi.advanceTimersByTimeAsync(0);
  expect(sdk.requestAuth).toHaveBeenCalledTimes(2);
  expect([...pkce.keys()]).toEqual(["sdk-state"]);
  third.abort();
  await thirdCancelled;
  expect(pkce.size).toBe(0);
});

it("cleans only this attempt's SDK entries and preserves pre-existing entries", async () => {
  pkce.set("other-sdk-request", "other-verifier");
  const native = await import("@/lib/auth/gorth");
  const controller = new AbortController();
  const cancelled = expect(
    native.loginGorth(controller.signal),
  ).rejects.toThrow("cancelled");
  await vi.advanceTimersByTimeAsync(0);
  expect(
    await native.receiveGorthDeepLink(
      callback(native.authScheme, "other-sdk-request"),
    ),
  ).toBe(false);
  controller.abort();
  await cancelled;
  expect([...pkce.keys()]).toEqual(["other-sdk-request"]);
});

it("does not let a cancelled in-flight exchange fail or clear a newer session", async () => {
  let rejectExchange!: (error: Error) => void;
  sdk.authenticate.mockReturnValueOnce(
    new Promise((_, reject) => {
      rejectExchange = reject;
    }),
  );
  const native = await import("@/lib/auth/gorth");
  const first = new AbortController();
  const cancelled = expect(native.loginGorth(first.signal)).rejects.toThrow(
    "cancelled",
  );
  await vi.advanceTimersByTimeAsync(0);
  const oldExchange = native.receiveGorthDeepLink(
    callback(native.authScheme, "sdk-state"),
  );
  first.abort();
  await cancelled;
  const retry = new AbortController();
  const retryResult = expect(native.loginGorth(retry.signal)).rejects.toThrow(
    "cancelled",
  );
  await vi.advanceTimersByTimeAsync(0);
  rejectExchange(new Error("cancelled exchange"));
  await oldExchange;
  expect(pkce.has("sdk-state")).toBe(true);
  retry.abort();
  await retryResult;
});
