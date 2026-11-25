import { beforeAll, describe, expect, it, vi } from "vitest";
import { createDesktopHandler } from "@/lib/server/handler";
import { buildDesktopBackend } from "@/lib/server/build";
beforeAll(() => buildDesktopBackend(process.cwd()), 60000);

// These tests exercise HTTP policies only; never open a live SQLite profile.
vi.mock("@/models/user-profile", () => ({ rawGetUserProfile: () => null }));
const origin = "http://127.0.0.1:5500";
const capability = "synthetic-desktop-capability";
function request(path: string, options: RequestInit = {}) {
  const routes = createDesktopHandler({
    applicationDirectory: process.cwd(),
    origin,
    capability,
    getIdentityId: () => null,
  });
  const headers = new Headers(options.headers);
  if (!headers.has("host")) headers.set("host", new URL(origin).host);
  return routes.fetch(new Request(origin + path, { ...options, headers }));
}
describe("Nitro filesystem backend preserves desktop security policies", () => {
  it("serves health without authentication or response caching and rejects foreign hosts", async () => {
    const response = await request("/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(
      (await request("/health", { headers: { host: "foreign.example" } }))
        .status,
    ).toBe(400);
  });
  it("requires the capability and a trusted request origin before reading profiles", async () => {
    expect((await request("/user/profile")).status).toBe(403);
    expect(
      (
        await request("/user/profile", {
          headers: {
            "x-gorth-desktop-session": capability,
            origin: "https://foreign.example",
          },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await request("/user/profile", {
          headers: { "x-gorth-desktop-session": capability },
        })
      ).status,
    ).toBe(401);
  });
  it("retains CSRF's 403 status rather than converting it to an internal server error", async () => {
    const response = await request("/user/profile", {
      method: "POST",
      headers: {
        origin: "https://foreign.example",
        "sec-fetch-site": "cross-site",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "value=fixture",
    });
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});

it("keeps HEAD and body-limit responses compatible", async () => {
  const head = await request("/health", { method: "HEAD" });
  expect(head.status).toBe(200);
  expect(await head.text()).toBe("");
  const large = await request("/health", {
    method: "POST",
    headers: { "content-length": String(1024 * 1024 + 1) },
    body: "x",
  });
  expect(large.status).toBe(413);
  expect(large.headers.get("cache-control")).toBe("no-store");
});
