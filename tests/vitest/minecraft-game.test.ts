import { beforeEach, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({
  request: vi.fn(),
  cookie: vi.fn(),
  owner: "central-owner" as string | null,
}));
vi.mock("@/utils/environment", () => ({ authUrl: "https://launcher.test" }));
vi.mock("@/lib/auth/gorth", () => ({
  getGorthClient: () => ({ getCookie: fixture.cookie }),
  getGorthUserId: () => fixture.owner,
}));
vi.mock("@/lib/auth/http", async (original) => ({
  ...(await original<typeof import("@/lib/auth/http")>()),
  requestJson: fixture.request,
}));
import {
  fetchNativeGameProfile,
  issueNativeGameSession,
} from "@/lib/auth/gorth-game";
beforeEach(() => {
  vi.resetAllMocks();
  fixture.owner = "central-owner";
  fixture.cookie.mockReturnValue("fixture-native-cookie");
  fixture.request.mockImplementation(async (_url, options) => ({
    clientToken: JSON.parse(options.body).clientToken,
    accessToken: "a".repeat(43),
    expiresAt: Date.now() + 60_000,
    selectedProfile: { id: "a".repeat(32), name: "Player" },
    authlibRoot: "https://launcher.test/minecraft",
  }));
});
it("uses the official cookie API only in the main-process bridge and binds every game credential", async () => {
  const signal = new AbortController().signal;
  const result = await issueNativeGameSession(signal);
  expect(result).toMatchObject({
    ownerId: "central-owner",
    provider: "gorth",
    username: "Player",
    tokens: { binding: "https://launcher.test/minecraft" },
  });
  const [url, options, requestSignal] = fixture.request.mock.calls[0];
  expect(url.href).toBe("https://launcher.test/minecraft/session");
  expect(requestSignal).toBe(signal);
  expect(options.headers).toMatchObject({
    Origin: "com.gorth.launcher:/",
    Cookie: "fixture-native-cookie",
  });
  expect(options.body).not.toContain("password");
});
it("rejects response substitution and malformed or overlong credentials", async () => {
  for (const patch of [
    { authlibRoot: "https://attacker.test/minecraft" },
    { clientToken: "wrong" },
    { accessToken: "a".repeat(43) + "\n" },
    { expiresAt: Date.now() + 9 * 60 * 60_000 },
    { expiresAt: NaN },
  ]) {
    fixture.request.mockImplementationOnce(async (_url, options) => ({
      clientToken: JSON.parse(options.body).clientToken,
      accessToken: "a".repeat(43),
      expiresAt: Date.now() + 60_000,
      selectedProfile: { id: "a".repeat(32), name: "Player" },
      authlibRoot: "https://launcher.test/minecraft",
      ...patch,
    }));
    await expect(
      issueNativeGameSession(new AbortController().signal),
    ).rejects.toThrow("không hợp lệ");
  }
});
it("fences sign-out or account switching while a native request is in flight", async () => {
  fixture.request.mockImplementationOnce(async () => {
    fixture.owner = "another-owner";
    return { profile: { id: "a".repeat(32), name: "Player" } };
  });
  await expect(
    fetchNativeGameProfile(new AbortController().signal),
  ).rejects.toThrow("thay đổi");
  fixture.owner = null;
  await expect(
    issueNativeGameSession(new AbortController().signal),
  ).rejects.toThrow("đăng nhập");
});
it("handles missing game profiles separately from SSO sign-in", async () => {
  fixture.request.mockResolvedValueOnce({ profile: null });
  expect(await fetchNativeGameProfile(new AbortController().signal)).toBeNull();
});
