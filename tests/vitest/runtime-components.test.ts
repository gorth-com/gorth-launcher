import { beforeEach, expect, it, vi } from "vitest";
import { runtimeComponents } from "@/lib/game/runtime-components";

const fixture = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/lib/game/files", () => ({
  readJson: fixture.read,
  safePath: (root: string, file: string) => root + "/" + file,
}));
vi.mock("@/lib/game/install", () => ({
  validateInstance: (instance: { id: string }) => {
    if (instance.id.includes("/")) throw new Error("Invalid instance");
  },
}));
const instance = {
  id: "fixture",
  name: "Fixture",
  version: "1.20.1",
  loader: "Forge",
  loaderVersion: "47.4.28",
  createdAt: 0,
};
beforeEach(() => vi.clearAllMocks());
it("reads LWJGL from installed metadata and retains the actual runtime versions", async () => {
  fixture.read.mockResolvedValue({
    libraries: [{ name: "org.lwjgl:lwjgl:3.3.1" }],
  });
  expect(await runtimeComponents("/fixture", instance)).toEqual([
    { id: "lwjgl", name: "LWJGL", version: "3.3.1" },
    { id: "minecraft", name: "Minecraft", version: "1.20.1" },
    { id: "loader", name: "Forge", version: "47.4.28" },
  ]);
});
it("does not invent an LWJGL version before installation or a Vanilla loader row", async () => {
  fixture.read.mockRejectedValue(
    Object.assign(new Error("missing"), { code: "ENOENT" }),
  );
  expect(
    await runtimeComponents("/fixture", { ...instance, loader: "Vanilla" }),
  ).toEqual([
    { id: "lwjgl", name: "LWJGL", version: "Chưa tải metadata" },
    { id: "minecraft", name: "Minecraft", version: "1.20.1" },
  ]);
});
it("reports malformed or unreadable installed metadata instead of silently hiding it", async () => {
  fixture.read.mockRejectedValue(new SyntaxError("Invalid metadata"));
  await expect(runtimeComponents("/fixture", instance)).rejects.toThrow(
    "Invalid metadata",
  );
});
