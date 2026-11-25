import { afterEach, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { mergeModpackUpdate, verifyModpackArchive } from "@/lib/content/packs";

const directories: string[] = [];
const hash = (text: string) => createHash("sha1").update(text).digest("hex");
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});
it("accepts only the local archive matching the selected provider release", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "gorth-pack-checksum-"));
  directories.push(root);
  const archive = path.join(root, "pack.zip");
  await writeFile(archive, "selected-release");
  const artifact = {
    url: "https://example.test/pack.zip",
    sha1: hash("selected-release"),
  };
  await expect(
    verifyModpackArchive(archive, artifact),
  ).resolves.toBeUndefined();
  await writeFile(archive, "different-release");
  await expect(verifyModpackArchive(archive, artifact)).rejects.toThrow(
    "Checksum",
  );
});
it("keeps user-modified files and records the new pack version and provider release", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "gorth-pack-merge-"));
  directories.push(root);
  const live = path.join(root, "live"),
    next = path.join(root, "next");
  for (const folder of [live, next])
    await mkdir(path.join(folder, "game"), { recursive: true });
  const source = { provider: "curseforge", projectId: "123", versionId: "old" };
  await writeFile(path.join(live, "game", "user.txt"), "user-change");
  await writeFile(path.join(live, "game", "managed.txt"), "old");
  await writeFile(
    path.join(live, ".gorth-modpack.json"),
    JSON.stringify({
      version: 1,
      source,
      files: { "user.txt": hash("original"), "managed.txt": hash("old") },
    }),
  );
  await writeFile(path.join(next, "game", "user.txt"), "upstream");
  await writeFile(path.join(next, "game", "managed.txt"), "new");
  await writeFile(
    path.join(next, ".gorth-modpack.json"),
    JSON.stringify({
      version: 1,
      name: "Pack",
      packVersion: "2.1.1",
      source: { ...source, versionId: "new" },
      files: { "user.txt": hash("upstream"), "managed.txt": hash("new") },
    }),
  );
  await mergeModpackUpdate(live, next);
  expect(await readFile(path.join(live, "game", "user.txt"), "utf8")).toBe(
    "user-change",
  );
  expect(await readFile(path.join(live, "game", "managed.txt"), "utf8")).toBe(
    "new",
  );
  expect(
    JSON.parse(await readFile(path.join(live, ".gorth-modpack.json"), "utf8")),
  ).toMatchObject({
    packVersion: "2.1.1",
    source: { ...source, versionId: "new" },
  });
});
