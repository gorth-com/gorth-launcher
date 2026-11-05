import path from "node:path";
import os from "node:os";
import { readFileSync, statSync } from "node:fs";

export const launcherFolderNames = {
  root: "Launcher root",
  instances: "Instances",
  mods: "Central mods",
  skins: "Skins",
  java: "Java",
  iconThemes: "Icon themes",
  widgetThemes: "Widget themes",
  catPacks: "Cat packs",
  instanceIcons: "Instance icons",
  downloads: "Downloads",
  logs: "Logs",
} as const;
export type LauncherFolderKey = keyof typeof launcherFolderNames;
export type LauncherFolderPreferences = Partial<
  Record<LauncherFolderKey, string>
>;

const active = new Map<string, LauncherFolderPreferences>();
const gameFolders = new Map<string, Record<string, string>>();
export function folderPreferencesFile(dataPath: string) {
  return path.join(dataPath, "folder-locations.json");
}
export function readFolderPreferences(
  dataPath: string,
): LauncherFolderPreferences {
  try {
    const file = folderPreferencesFile(dataPath);
    if (statSync(file).size > 64 * 1024)
      throw new Error("Invalid folder settings");
    const value: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("Invalid folder settings");
    const result: LauncherFolderPreferences = {};
    for (const key of Object.keys(launcherFolderNames) as LauncherFolderKey[]) {
      const target = (value as Record<string, unknown>)[key];
      if (target === undefined) continue;
      if (
        typeof target !== "string" ||
        target.length > 4096 ||
        target.includes("\0") ||
        !path.isAbsolute(target) ||
        path.parse(target).root === target
      )
        throw new Error("Invalid folder settings");
      result[key] = path.resolve(target);
    }
    return result;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw new Error(
      "Không đọc được cấu hình thư mục. Dữ liệu cũ được giữ nguyên.",
    );
  }
}
export function activeFolderPreferences(dataPath: string) {
  const key = path.resolve(dataPath);
  if (!active.has(key)) active.set(key, readFolderPreferences(key));
  return active.get(key)!;
}
export function launcherFolderPaths(
  dataPath: string,
  preferences: LauncherFolderPreferences,
  downloads = path.join(os.homedir(), "Downloads"),
): Record<LauncherFolderKey, string> {
  const root = preferences.root ?? path.join(dataPath, "minecraft");
  return {
    root,
    instances: preferences.instances ?? path.join(root, "instances"),
    mods: preferences.mods ?? path.join(root, "mods"),
    skins: preferences.skins ?? path.join(root, "skins"),
    java: preferences.java ?? path.join(root, "runtime"),
    iconThemes: preferences.iconThemes ?? path.join(root, "icon-themes"),
    widgetThemes: preferences.widgetThemes ?? path.join(root, "widget-themes"),
    catPacks: preferences.catPacks ?? path.join(root, "cat-packs"),
    instanceIcons: preferences.instanceIcons ?? path.join(root, "icons"),
    downloads: preferences.downloads ?? downloads,
    logs: preferences.logs ?? path.join(dataPath, "logs"),
  };
}
export function getLauncherFolders(dataPath: string, downloads?: string) {
  const paths = launcherFolderPaths(
    dataPath,
    activeFolderPreferences(dataPath),
    downloads,
  );
  gameFolders.set(path.resolve(paths.root), {
    instances: paths.instances,
    runtime: paths.java,
    mods: paths.mods,
    skins: paths.skins,
    icons: paths.instanceIcons,
  });
  return paths;
}
// Engine roots are passed explicitly in tests; only registered workspace roots
// redirect managed subdirectories, never arbitrary paths inside an instance.
export function gameFolder(root: string, directory: string) {
  return (
    gameFolders.get(path.resolve(root))?.[directory] ??
    path.join(root, directory)
  );
}
