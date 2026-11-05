import { expect, it, vi } from "vitest";
it("stores browser choice through trusted IPC without unlocking Keychain", async () => {
  registerAuthIpc();
  calls.available = false;
  const event = { sender, senderFrame: frame };
  const before = calls.decrypt;
  const choose = handlers.get("auth:login-browser")!;
  const selected = (await choose(
    event,
    "gorth",
  )) as import("@/utils/interface").AuthResult;
  expect(selected.snapshot.loginBrowser).toBe("gorth");
  expect(
    ((await choose(event, "invalid")) as import("@/utils/interface").AuthResult)
      .ok,
  ).toBe(false);
  await expect(async () =>
    choose({ sender: {}, senderFrame: frame }, "default"),
  ).rejects.toThrow("Untrusted");
  expect(calls.decrypt).toBe(before);
  expect(
    ((await choose(event, "default")) as import("@/utils/interface").AuthResult)
      .snapshot.loginBrowser,
  ).toBe("default");
});
import { calls, frame, handlers, sender } from "./electron-auth-mock";
import { registerAuthIpc, resolveGameSession } from "@/lib/auth/service";
import type { GameAccount } from "@/utils/interface";
vi.mock("@/main/rpc/sender", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/main/rpc/sender")>()),
  getRpcRendererUrl: () => "http://localhost:5502/public/index.html",
}));
vi.mock("electron", () => import("./electron-auth-mock"));
vi.mock("@/lib/auth/gorth-game", () => ({
  gameBinding: () => "http://localhost:5504/minecraft",
  fetchNativeGameProfile: async () => native.game,
  issueNativeGameSession: (signal: AbortSignal) => native.issue(signal),
}));
vi.mock("@/services/user-profile", () => ({ upsertUserProfile: vi.fn() }));
const native = vi.hoisted(() => ({
  user: null as null | {
    id: string;
    name: string;
    expiresAt: number;
    needsLogin: boolean;
    verifiedAt: number;
    canRefresh: boolean;
  },
  signOut: vi.fn(),
  restore: vi.fn(),
  game: null as GameAccount | null,
  issue: vi.fn(),
  subject: "sso-sub",
}));
vi.mock("@/lib/auth/gorth", () => ({
  gorthSnapshot: () => ({
    user: native.user,
    locked: !native.user,
    configured: true,
  }),
  getGorthUserId: () => native.user?.id ?? null,
  onGorthChanged: () => () => {},
  restoreGorthSession: async () => {
    native.restore();
    native.user = {
      id: native.subject,
      name: "Fixture",
      expiresAt: Date.now() + 120000,
      verifiedAt: Date.now(),
      canRefresh: true,
      needsLogin: false,
    };
  },
  signOutGorth: async () => {
    native.user = null;
    native.signOut();
  },
  loginGorth: vi.fn(),
}));

it("keeps startup snapshots and automatic refresh away from locked credentials", async () => {
  calls.available = false;
  native.user = null;
  native.restore.mockClear();
  registerAuthIpc();
  const event = { sender, senderFrame: frame };
  const decryptions = calls.decrypt;
  const snapshot = (await handlers.get("auth:snapshot")!(
    event,
  )) as import("@/utils/interface").AuthResult;
  expect(snapshot.snapshot.locked).toBe(true);
  expect(snapshot.snapshot.launcher).toBeNull();
  const result = (await handlers.get("auth:command")!(event, {
    action: "launcher.refresh",
  })) as import("@/utils/interface").AuthResult;
  expect(result.ok).toBe(false);
  expect(result.snapshot.locked).toBe(true);
  expect(native.restore).not.toHaveBeenCalled();
  expect(calls.decrypt).toBe(decryptions);
});

it("uses native public session snapshots, rejects foreign IPC and never exposes credentials", async () => {
  calls.available = true;
  registerAuthIpc();
  const event = { sender, senderFrame: frame };
  const command = async (action: string) =>
    (await handlers.get("auth:command")!(event, {
      action,
    })) as import("@/utils/interface").AuthResult;
  expect((await command("launcher.unlock")).snapshot.launcher?.id).toBe(
    "sso-sub",
  );
  expect(native.restore).toHaveBeenCalledOnce();
  expect((await command("launcher.refresh")).ok).toBe(true);
  expect(native.restore).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(calls.snapshots)).not.toMatch(
    /accessToken|refreshToken|session_token/,
  );
  await expect(async () =>
    handlers.get("auth:command")!(
      { sender: {}, senderFrame: frame },
      { action: "launcher.unlock" },
    ),
  ).rejects.toThrow("Untrusted");
  await expect(async () =>
    handlers.get("auth:snapshot")!({ sender, senderFrame: {} }),
  ).rejects.toThrow("Untrusted");
  expect((await command("launcher.logout")).snapshot.launcher).toBeNull();
  expect(native.signOut).toHaveBeenCalledTimes(1);
});

it("resolves the selected Gorth game profile in main without exposing the game credential over IPC", async () => {
  calls.available = true;
  native.game = {
    id: "gorth:" + "a".repeat(32),
    provider: "gorth",
    ownerId: "sso-sub",
    uuid: "a".repeat(32),
    username: "Player",
  };
  native.issue.mockResolvedValue({
    ...native.game,
    tokens: {
      accessToken: "a".repeat(43),
      binding: "http://localhost:5504/minecraft",
      expiresAt: Date.now() + 60_000,
      sid: "sso-sub",
    },
  });
  const event = { sender, senderFrame: frame };
  await handlers.get("auth:command")!(event, { action: "launcher.unlock" });
  expect(await resolveGameSession(native.game.id)).toEqual({
    username: "Player",
    uuid: "a".repeat(32),
    accessToken: "a".repeat(43),
    authlibRoot: "http://localhost:5504/minecraft",
  });
  const publicResult = await handlers.get("auth:snapshot")!(event);
  expect(JSON.stringify(publicResult)).not.toContain("a".repeat(43));
  expect(JSON.stringify(calls.snapshots)).not.toMatch(
    /accessToken|refreshToken|session_token/,
  );
  native.subject = "another-owner";
  await expect(resolveGameSession(native.game.id)).rejects.toThrow(
    "đúng tài khoản",
  );
  expect(native.issue).toHaveBeenCalledTimes(1);
});
