import path from "node:path";
import { access, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { BrowserWindow, dialog, ipcMain, nativeTheme } from "electron";
import { openLauncherFolder } from "@/main/services/folders";
import { z } from "@gorth-io/structure/cores/zod";
import { getRpcRendererUrl, isRpcRendererUrl } from "@/main/rpc/sender";
import { registerJavaSettingsIpc } from "@/main/services/java-settings";

export function registerSettingsIpc() {
  function trusted(event: Electron.IpcMainInvokeEvent) {
    const owner = BrowserWindow.fromWebContents(event.sender);
    if (
      !owner ||
      owner.webContents !== event.sender ||
      event.senderFrame !== event.sender.mainFrame ||
      !isRpcRendererUrl(event.sender.getURL(), getRpcRendererUrl())
    )
      throw new Error("Untrusted settings request.");
    return owner;
  }
  registerJavaSettingsIpc(trusted);
  ipcMain.handle("settings:theme", (event, input: unknown) => {
    trusted(event);
    nativeTheme.themeSource = z.enum(["light", "dark", "system"]).parse(input);
  });
  ipcMain.handle("settings:open-folder", async (event, input: unknown) => {
    trusted(event);
    const key = z.enum(["data", "instances", "java", "downloads"]).parse(input);
    await openLauncherFolder(key);
  });
  ipcMain.handle("settings:choose-tool", async (event) => {
    const owner = trusted(event);
    const result = await dialog.showOpenDialog(owner, {
      title: "Choose a tool executable",
      properties: ["openFile"],
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });
  ipcMain.handle("settings:check-tool", async (event, input: unknown) => {
    trusted(event);
    const file = z
      .string()
      .min(1)
      .max(4096)
      .refine(path.isAbsolute)
      .parse(input);
    try {
      if (!(await stat(file)).isFile()) return false;
      await access(
        file,
        process.platform === "win32" ? constants.F_OK : constants.X_OK,
      );
      return true;
    } catch {
      return false;
    }
  });
}
