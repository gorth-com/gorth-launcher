import path from "node:path";
import { randomUUID } from "node:crypto";
import { cp, readdir } from "node:fs/promises";
import { safeExtract } from "@/lib/instance/archive";
import { regularDirectory } from "./install";

export async function findWorldRoots(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  if (entries.some((entry) => entry.name === "level.dat" && entry.isFile()))
    return [directory];
  const roots: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const child = path.join(directory, entry.name);
    const files = await readdir(child, { withFileTypes: true });
    if (files.some((file) => file.name === "level.dat" && file.isFile()))
      roots.push(child);
  }
  return roots;
}

export async function installWorld(
  archive: string,
  staging: string,
  game: string,
  signal: AbortSignal,
) {
  const unpacked = path.join(staging, "world");
  await safeExtract(archive, unpacked);
  const worlds = await findWorldRoots(unpacked);
  if (worlds.length !== 1)
    throw new Error(
      "Archive phải chứa đúng một world có level.dat ở gốc hoặc trong thư mục con.",
    );
  signal.throwIfAborted();
  const saves = await regularDirectory(game, "saves");
  await cp(worlds[0], path.join(saves, `world-${randomUUID()}`), {
    recursive: true,
    force: false,
    errorOnExist: true,
  });
}
