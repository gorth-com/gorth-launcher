import { expect, it } from "vitest";
import { offlineUuid, username, profile, trustedUrl, tokenSet } from "@/lib/auth/model";
it("preserves offline Minecraft identities and rejects invalid names", () => {
  expect(offlineUuid("Notch")).toBe("b50ad385829d3141a2167e7d7539ba7f");
  expect(offlineUuid("Player")).not.toBe(offlineUuid("player"));
  for (const name of ["", "../Player", "player name", "a".repeat(17), "<script>"])
    expect(() => username(name)).toThrow();
  expect(profile({ id: "b50ad385-829d-3141-a216-7e7d7539ba7f", name: "Notch" })).toEqual({ uuid: offlineUuid("Notch"), username: "Notch" });
});
it("retains game-token rotation checks independently of the native Gorth app session", () => {
  expect(() => trustedUrl("http://example.com")).toThrow();
  expect(() => trustedUrl("https://secret:password@example.com")).toThrow();
  expect(trustedUrl("http://127.0.0.1:1234", true).protocol).toBe("http:");
  expect(() => tokenSet({ access_token: "a", expires_in: -1, token_type: "Bearer" }, "provider")).toThrow();
  const previous = tokenSet({ access_token: "a", refresh_token: "r1", expires_in: 60, token_type: "Bearer" }, "provider");
  expect(tokenSet({ access_token: "b", expires_in: 60, token_type: "Bearer" }, "provider", previous).refreshToken).toBe("r1");
  expect(tokenSet({ access_token: "b", refresh_token: "r2", expires_in: 60, token_type: "Bearer" }, "provider", previous).refreshToken).toBe("r2");
});
