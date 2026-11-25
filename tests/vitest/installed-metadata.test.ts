import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { build } from "vite";
import { inspectJar } from "@/lib/content/jar-metadata";
import { identifyInstalledMods } from "@/lib/content/installed-metadata";
import { providerJson } from "@/lib/content/providers";
import type { ContentInventory } from "@/lib/content/interface";
vi.mock("@/lib/content/providers", () => ({
  providerJson: vi.fn(),
  hasCurseForgeKey: () => true,
}));
const directories: string[] = [];
afterEach(async () => {
  vi.resetAllMocks();
  await Promise.all(
    directories
      .splice(0)
      .map((dir) => rm(dir, { recursive: true, force: true })),
  );
});
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "gorth-mod-identify-"));
  directories.push(root);
  await mkdir(path.join(root, "game/mods"), { recursive: true });
  return root;
}
function jar(text: string) {
  const name = Buffer.from("fabric.mod.json"),
    data = Buffer.from(text);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50);
  local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(local.length + name.length + data.length, 16);
  return Buffer.concat([local, name, data, central, name, end]);
}
it("reads JAR metadata and fingerprints in a worker without executing its contents", async () => {
  const root = await fixture(),
    filename = path.join(root, "game/mods/renamed.jar");
  const bytes = jar(JSON.stringify({ name: "Fixture Mod", version: "1.2.3" }));
  await writeFile(filename, bytes);
  const result = await inspectJar(filename);
  expect(result).toMatchObject({
    name: "Fixture Mod",
    version: "1.2.3",
    checksum: createHash("sha1").update(bytes).digest("hex"),
  });
  expect(result?.fingerprint).toBeGreaterThanOrEqual(0);
  // CurseForge's whitespace filtering must give the same hash for these bytes.
  await writeFile(filename, Buffer.from("hello world\n"));
  const spaced = await inspectJar(filename);
  await writeFile(filename, Buffer.from("helloworld"));
  expect((await inspectJar(filename))?.fingerprint).toBe(spaced?.fingerprint);
});
function inventory(provider: "curseforge" | "modrinth"): ContentInventory {
  return {
    instanceId: "fixture",
    worlds: [],
    items: [
      {
        id: "managed",
        filename: "renamed.jar",
        kind: "mod",
        directory: "mods",
        enabled: true,
        managed: true,
        modified: false,
        provider,
        projectId: "123",
        versionId: "456",
        checksum: "a".repeat(40),
      },
    ],
  };
}
it.each(["curseforge", "modrinth"] as const)(
  "uses the recorded %s provider and caches metadata without changing management identity",
  async (provider) => {
    const root = await fixture();
    vi.mocked(providerJson).mockImplementation(async (source, route) => {
      expect(source).toBe(provider);
      if (provider === "curseforge")
        return (
          route.includes("/files/")
            ? { data: { modId: 123, displayName: "Version 1" } }
            : {
                data: {
                  id: 123,
                  slug: "fixture",
                  name: "CF Fixture",
                  summary: "Summary",
                  downloadCount: 50,
                },
              }
        ) as never;
      return (
        route.startsWith("/version/")
          ? { project_id: "123", version_number: "1.0" }
          : {
              id: "123",
              slug: "fixture",
              title: "MR Fixture",
              description: "Description",
              downloads: 40,
            }
      ) as never;
    });
    const result = await identifyInstalledMods(root, inventory(provider));
    expect(result.items[0].metadata?.provider).toBe(provider);
    expect(result.items[0]).toMatchObject({
      id: "managed",
      managed: true,
      projectId: "123",
      versionId: "456",
    });
    expect(result.items[0].metadata?.project.name).toBe(
      provider === "curseforge" ? "CF Fixture" : "MR Fixture",
    );
    const calls = vi.mocked(providerJson).mock.calls.length;
    await identifyInstalledMods(root, inventory(provider));
    expect(vi.mocked(providerJson)).toHaveBeenCalledTimes(calls);
    expect(
      JSON.parse(
        await readFile(path.join(root, ".gorth-mod-metadata.json"), "utf8"),
      ),
    ).toBeTruthy();
  },
);
it("keeps the file list when a provider is offline", async () => {
  const root = await fixture();
  vi.mocked(providerJson).mockRejectedValue(new Error("Offline"));
  const result = await identifyInstalledMods(root, inventory("curseforge"));
  expect(result.items[0].filename).toBe("renamed.jar");
  expect(result.metadataError).toBeTruthy();
});
it.each(["curseforge", "modrinth"] as const)(
  "identifies a renamed external JAR through %s and leaves local management IDs intact",
  async (provider) => {
    const root = await fixture(),
      filename = path.join(root, "game/mods/renamed.jar");
    const bytes = jar(JSON.stringify({ name: "Local name", version: "1" }));
    await writeFile(filename, bytes);
    const scan = await inspectJar(filename);
    expect(scan).not.toBeNull();
    const input = inventory("curseforge");
    Object.assign(input.items[0], {
      id: "file:mods::renamed.jar",
      managed: false,
      provider: null,
      projectId: null,
      versionId: null,
      checksum: scan!.checksum,
      origin: { provider },
    });
    vi.mocked(providerJson).mockImplementation(
      async (_source, route, _signal, body) => {
        expect(_source).toBe(provider);
        if (route === "/fingerprints/432") {
          expect(body).toEqual({ fingerprints: [scan!.fingerprint] });
          return {
            data: {
              exactMatches:
                provider === "curseforge"
                  ? [
                      {
                        file: {
                          id: 456,
                          modId: 123,
                          fileFingerprint: scan!.fingerprint,
                          hashes: [{ algo: 1, value: scan!.checksum }],
                        },
                      },
                    ]
                  : [],
            },
          } as never;
        }
        if (route === "/version_files")
          return {
            [scan!.checksum]: {
              id: "456",
              project_id: "123",
              files: [{ hashes: { sha1: scan!.checksum } }],
            },
          } as never;
        if (provider === "curseforge")
          return (
            route.includes("/files/")
              ? { data: { modId: 123, displayName: "Version 1" } }
              : {
                  data: {
                    id: 123,
                    slug: "fixture",
                    name: "CF Match",
                    summary: "Summary",
                    downloadCount: 1,
                  },
                }
          ) as never;
        return (
          route.startsWith("/version/")
            ? { project_id: "123", version_number: "1" }
            : {
                id: "123",
                slug: "fixture",
                title: "MR Match",
                description: "Description",
                downloads: 1,
              }
        ) as never;
      },
    );
    const result = await identifyInstalledMods(root, input);
    expect(result.items[0].metadata?.provider).toBe(provider);
    expect(result.items[0].metadata?.project.name).toBe(
      provider === "curseforge" ? "CF Match" : "MR Match",
    );
    expect(result.items[0]).toMatchObject({
      id: "file:mods::renamed.jar",
      managed: false,
      provider: null,
    });
  },
);
it("keeps the worker self-contained after a production Vite CommonJS build", async () => {
  const root = await fixture();
  const filename = path.join(root, "game/mods/fixture.jar");
  await writeFile(
    filename,
    jar(JSON.stringify({ name: "Bundled Mod", version: "2" })),
  );
  await build({
    configFile: false,
    envDir: false,
    logLevel: "error",
    build: {
      ssr: path.resolve("lib/content/jar-metadata.ts"),
      outDir: path.join(root, "bundle"),
      rolldownOptions: {
        output: { format: "cjs", entryFileNames: "worker.cjs" },
      },
    },
  });
  const bundled = createRequire(import.meta.url)(
    path.join(root, "bundle/worker.cjs"),
  ) as typeof import("@/lib/content/jar-metadata");
  expect(await bundled.inspectJar(filename)).toMatchObject({
    name: "Bundled Mod",
    version: "2",
  });
});
