import { beforeEach, expect, it, vi } from "vitest";
import {
  modpackOverview,
  modpackChangelog,
} from "@/lib/content/modpack-overview";
const fixture = vi.hoisted(() => ({
  receipt: vi.fn(),
  json: vi.fn(),
  versions: vi.fn(),
}));
vi.mock("@/lib/content/packs", () => ({ readModpackReceipt: fixture.receipt }));
vi.mock("@/lib/content/providers", () => ({
  providerJson: fixture.json,
  contentVersions: fixture.versions,
}));
const instance = {
  id: "test",
  name: "Local name",
  version: "1.20.1",
  loader: "Forge",
  loaderVersion: "47.4.28",
  createdAt: 0,
};
beforeEach(() => {
  vi.resetAllMocks();
  fixture.receipt.mockResolvedValue({
    name: "Pack",
    packVersion: "2.0.0",
    source: {
      provider: "curseforge",
      projectId: "1526695",
      versionId: "9418600",
    },
  });
});
it("does not add pack information to an ordinary instance", async () => {
  fixture.receipt.mockResolvedValue(null);
  expect(
    await modpackOverview("/tmp/fixture", instance, AbortSignal.timeout(1000)),
  ).toBeNull();
  expect(fixture.json).not.toHaveBeenCalled();
});
it("retains local pack information when the provider is offline", async () => {
  fixture.json.mockRejectedValue(new Error("offline"));
  fixture.versions.mockResolvedValue([]);
  expect(
    await modpackOverview("/tmp/fixture", instance, AbortSignal.timeout(1000)),
  ).toMatchObject({
    name: "Pack",
    currentVersion: "2.0.0",
    onlineError: "offline",
    versions: [],
  });
});
it("loads real provider identifiers and releases with the instance runtime", async () => {
  fixture.json.mockImplementation(async (_provider, route) =>
    route.includes("/files/")
      ? { data: { modId: 1526695, displayName: "Current archive" } }
      : { data: { name: "Master of Cipher", slug: "master-of-cipher" } },
  );
  fixture.versions.mockResolvedValue([
    { id: "next", name: "2.1.1", filename: "pack.zip" },
  ]);
  const result = await modpackOverview(
    "/tmp/fixture",
    instance,
    AbortSignal.timeout(1000),
  );
  expect(result).toMatchObject({
    name: "Master of Cipher",
    currentVersion: "2.0.0",
    versions: [{ id: "next" }],
  });
  expect(result?.website).toBe(
    "https://www.curseforge.com/minecraft/modpacks/master-of-cipher",
  );
  expect(fixture.versions.mock.calls[0][0]).toMatchObject({
    kind: "modpack",
    version: "1.20.1",
    loader: "Forge",
  });
});
it("rejects Modrinth changelog from another project", async () => {
  fixture.receipt.mockResolvedValue({
    source: { provider: "modrinth", projectId: "pack", versionId: "old" },
  });
  fixture.json.mockResolvedValue({
    project_id: "other",
    changelog: "unexpected",
  });
  await expect(
    modpackChangelog(
      "/tmp/fixture",
      instance,
      "new",
      AbortSignal.timeout(1000),
    ),
  ).rejects.toThrow("không thuộc");
});
it("loads CurseForge changelog for the saved project and selected file ID", async () => {
  fixture.json.mockResolvedValue({ data: "<p>Major Updates</p>" });
  expect(
    await modpackChangelog(
      "/tmp/fixture",
      instance,
      "next",
      AbortSignal.timeout(1000),
    ),
  ).toEqual({
    text: "<p>Major Updates</p>",
    format: "html",
  });
  expect(fixture.json.mock.calls[0][1]).toBe(
    "/mods/1526695/files/next/changelog",
  );
});
