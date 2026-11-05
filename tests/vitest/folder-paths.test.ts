import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import {
  getLauncherFolders,
  launcherFolderPaths,
  folderPreferencesFile,
  readFolderPreferences,
} from "@/utils/launcher-folders";
import { safePath } from "@/lib/game/files";
import { createLibraryStore } from "@/services/library-store";
import { launcherSettingsSections } from "@/utils/constant";
import { createLauncherRouter } from "@/lib/navigation";
const roots: string[] = [];
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "gorth-folders-test-"));
  roots.push(root);
  return root;
}
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
it("registers Folders in the launcher settings layout", () => {
  expect(launcherSettingsSections.some((item) => item.id === "folders")).toBe(
    true,
  );
  expect(createLauncherRouter(() => null).routesByPath).toHaveProperty(
    "/settings/folders",
  );
});
it("preserves existing defaults and freezes active locations until restart", async () => {
  const data = await fixture();
  const original = getLauncherFolders(data);
  expect(original.instances).toBe(path.join(data, "minecraft/instances"));
  const selected = path.join(data, "new-root");
  await writeFile(
    folderPreferencesFile(data),
    JSON.stringify({ root: selected }),
  );
  expect(getLauncherFolders(data).root).toBe(original.root);
  expect(launcherFolderPaths(data, readFolderPreferences(data)).root).toBe(
    selected,
  );
});
it("routes game/content and runtime paths to their configured directories without allowing traversal", async () => {
  const data = await fixture();
  const root = path.join(data, "workspace");
  const instances = path.join(data, "external-instances");
  const java = path.join(data, "external-java");
  await writeFile(
    folderPreferencesFile(data),
    JSON.stringify({ root, instances, java }),
  );
  expect(getLauncherFolders(data)).toMatchObject({ root, instances, java });
  expect(safePath(root, "instances/abc/game")).toBe(
    path.join(instances, "abc/game"),
  );
  expect(safePath(root, "runtime/java/bin")).toBe(path.join(java, "java/bin"));
  expect(safePath(root, "assets/index.json")).toBe(
    path.join(root, "assets/index.json"),
  );
  for (const input of [
    "../escape",
    "instances/../escape",
    "/absolute",
    "instances\\escape",
  ])
    expect(() => safePath(root, input)).toThrow();
});
it("uses the chosen instance folder for library creation, trash and restore", async () => {
  const data = await fixture();
  const instances = path.join(data, "instances-outside-workspace");
  await writeFile(folderPreferencesFile(data), JSON.stringify({ instances }));
  const library = await createLibraryStore(data, () => false);
  try {
    let snapshot = await library.command({
      action: "create",
      name: "Folder fixture",
      version: "1.20.1",
      loader: "Vanilla",
    });
    const instance = snapshot.instances[0];
    await mkdir(path.join(instances, instance.id, "game"), { recursive: true });
    await writeFile(
      path.join(instances, instance.id, "game/marker.txt"),
      "keep",
    );
    snapshot = await library.command({ action: "delete", id: instance.id });
    expect(snapshot.trash).toHaveLength(1);
    expect(
      await readFile(
        path.join(instances, ".trash", instance.id, "game/marker.txt"),
        "utf8",
      ),
    ).toBe("keep");
    snapshot = await library.command({ action: "restore", id: instance.id });
    expect(snapshot.instances).toHaveLength(1);
    expect(
      await readFile(
        path.join(instances, instance.id, "game/marker.txt"),
        "utf8",
      ),
    ).toBe("keep");
  } finally {
    library.close();
  }
});
it("rejects corrupt and non-absolute path configuration instead of silently switching roots", async () => {
  const data = await fixture();
  for (const content of [
    '{"instances":"../outside"}',
    '{"java":"/"}',
    "broken-json",
  ]) {
    await writeFile(folderPreferencesFile(data), content);
    expect(() => readFolderPreferences(data)).toThrow();
  }
});
