import { beforeEach, expect, it, vi } from "vitest";
import { loaderCatalog } from "@/utils/constant";
import { installLoader } from "@/lib/game/loaders";
import { download } from "@/lib/game/files";
import type { Instance, Version } from "@/utils/interface";

vi.mock("@/lib/game/files", async () => {
  const { join } = await import("node:path");
  return {
    safePath: (root: string, relative: string) => join(root, relative),
    download: vi.fn(async () => {
      throw new Error("stop-before-io");
    }),
    digest: vi.fn(),
    json: vi.fn(),
    readJson: vi.fn(),
    response: vi.fn(),
  };
});
beforeEach(() => {
  vi.mocked(download).mockClear();
});

it.each(loaderCatalog.filter((entry) => entry.loader !== "Fabric"))(
  "has a pinned installer checksum for $loader $minecraft $version",
  async (entry) => {
    await expect(
      installLoader(
        "/unused-test-directory",
        {
          id: "test",
          name: "Test",
          createdAt: "",
          version: entry.minecraft,
          loader: entry.loader,
          loaderVersion: entry.version,
        } as Instance,
        { id: entry.minecraft } as Version,
        "java",
        new AbortController().signal,
        () => {},
      ),
    ).rejects.toThrow("stop-before-io");
    expect(download).toHaveBeenCalledTimes(1);
    const artifact = vi.mocked(download).mock.calls[0][0];
    expect(artifact.sha1).toMatch(/^[a-f0-9]{40}$/);
    expect(new URL(artifact.url).protocol).toBe("https:");
    expect(artifact.url).toContain(`${entry.version}-installer.jar`);
    if (entry.loader === "Forge" && entry.version === "47.4.28") {
      expect(artifact).toEqual({
        url: "https://maven.minecraftforge.net/net/minecraftforge/forge/1.20.1-47.4.28/forge-1.20.1-47.4.28-installer.jar",
        sha1: "585dd6071897becaed3b09bff4c3d9559e0cbc75",
      });
    }
  },
);
