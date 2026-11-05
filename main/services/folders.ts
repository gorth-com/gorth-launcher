import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  access,
  realpath,
  stat,
  writeFile,
  rename,
  mkdir,
} from "node:fs/promises";
import { constants } from "node:fs";
import { requestConfirmation } from "@/main/services/confirmation";
import { getRpcRendererUrl, isRpcRendererUrl } from "@/main/rpc/sender";
import {
  getLauncherFolders,
  launcherFolderNames,
  launcherFolderPaths,
  readFolderPreferences,
  folderPreferencesFile,
  type LauncherFolderKey,
} from "@/utils/launcher-folders";
import type { FolderSnapshot } from "@/utils/folder-interface";

const reserved = new Set<LauncherFolderKey>([
  "mods",
  "skins",
  "iconThemes",
  "widgetThemes",
  "catPacks",
  "instanceIcons",
]);
let choosing = false;
export function launcherFolderSnapshot(): FolderSnapshot {
  const data = app.getPath("userData");
  const active = getLauncherFolders(data, app.getPath("downloads"));
  const selected = launcherFolderPaths(
    data,
    readFolderPreferences(data),
    app.getPath("downloads"),
  );
  const executable = path.dirname(app.getPath("exe"));
  const application = app.isPackaged
    ? process.platform === "darwin"
      ? path.resolve(executable, "../..")
      : executable
    : app.getAppPath();
  const folders = [
    {
      id: "application",
      label: "Application",
      path: application,
      activePath: application,
      editable: false,
      description:
        "Installed application location. This path is not moved by settings.",
    },
    {
      id: "data",
      label: "Application data",
      path: data,
      activePath: data,
      editable: false,
      description:
        "Live profile, database and encrypted sessions. Not movable while the app is running.",
    },
    ...Object.entries(launcherFolderNames).map(([id, label]) => ({
      id,
      label,
      path: selected[id as LauncherFolderKey],
      activePath: active[id as LauncherFolderKey],
      editable: true,
      description: reserved.has(id as LauncherFolderKey)
        ? "Reserved location; this shared library/theme feature is not implemented yet."
        : id === "downloads"
          ? "Default location for exported archives and logs."
          : undefined,
    })),
  ];
  return {
    folders,
    restartRequired: folders.some(
      (folder) => folder.path !== folder.activePath,
    ),
  };
}
export async function openLauncherFolder(id: string) {
  const folder = launcherFolderSnapshot().folders.find(
    (item) => item.id === id,
  );
  if (!folder) throw new Error("Unknown folder.");
  await mkdir(folder.path, { recursive: true });
  const error = await shell.openPath(folder.path);
  if (error) throw new Error("Could not open folder.");
}
export function registerFolderIpc() {
  function trusted(event: Electron.IpcMainInvokeEvent) {
    const owner = BrowserWindow.fromWebContents(event.sender);
    if (
      !owner ||
      owner.webContents !== event.sender ||
      !event.senderFrame ||
      event.senderFrame !== event.sender.mainFrame ||
      !isRpcRendererUrl(event.senderFrame.url, getRpcRendererUrl())
    )
      throw new Error("Untrusted folder request.");
    return owner;
  }
  ipcMain.handle("folders:list", (event) => {
    trusted(event);
    return launcherFolderSnapshot();
  });
  ipcMain.handle("folders:open", (event, input: unknown) => {
    trusted(event);
    if (typeof input !== "string" || input.length > 80)
      throw new Error("Invalid folder.");
    return openLauncherFolder(input);
  });
  ipcMain.handle("folders:choose", async (event, input: unknown) => {
    const owner = trusted(event);
    if (typeof input !== "string" || !Object.hasOwn(launcherFolderNames, input))
      throw new Error("This folder cannot be changed.");
    if (choosing) throw new Error("A folder picker is already open.");
    choosing = true;
    try {
      const key = input as LauncherFolderKey;
      const current = launcherFolderSnapshot().folders.find(
        (folder) => folder.id === key,
      )!;
      const result = await dialog.showOpenDialog(owner, {
        title: "Choose " + current.label,
        defaultPath: current.path,
        properties: ["openDirectory", "createDirectory"],
      });
      if (result.canceled || !result.filePaths[0]) return null;
      const selected = await realpath(result.filePaths[0]);
      if (selected === current.path) return null;
      const profile = await realpath(app.getPath("userData"));
      if (
        !path.isAbsolute(selected) ||
        selected.length > 4096 ||
        selected === path.parse(selected).root ||
        selected === profile ||
        !(await stat(selected)).isDirectory()
      )
        throw new Error("Choose a dedicated writable folder.");
      await access(selected, constants.R_OK | constants.W_OK);
      if (
        !(await requestConfirmation(owner, {
          title: "Change folder after restart?",
          description:
            "Existing files will not be moved or deleted. Copy required data to the selected folder before restarting. Existing installations may need to be located or installed again.",
          confirmLabel: "Save path",
          cancelLabel: "Cancel",
        }))
      )
        return null;
      const data = app.getPath("userData");
      const preferences = { ...readFolderPreferences(data), [key]: selected };
      const file = folderPreferencesFile(data);
      const staging = file + "." + randomUUID() + ".tmp";
      await writeFile(staging, JSON.stringify(preferences), {
        mode: 0o600,
        flag: "wx",
      });
      await rename(staging, file);
      return launcherFolderSnapshot();
    } finally {
      choosing = false;
    }
  });
}
