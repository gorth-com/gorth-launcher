import path from "node:path";
import { getLauncherFolders } from "@/utils/launcher-folders";
import os from "node:os";
import { app, ipcMain, dialog, type BrowserWindow } from "electron";
import { z } from "@gorth-com/structure/cores/zod";
import { discoverJava, inspectJava, checkJava } from "@/lib/game/java";
import {
  javaPreferencesSchema,
  presetArguments,
} from "@/lib/library/game-preferences";

export function registerJavaSettingsIpc(
  trusted: (event: Electron.IpcMainInvokeEvent) => BrowserWindow,
) {
  ipcMain.handle("settings:java-installations", async (event) => {
    trusted(event);
    return discoverJava(getLauncherFolders(app.getPath("userData")).root);
  });
  ipcMain.handle("settings:choose-java", async (event) => {
    const result = await dialog.showOpenDialog(trusted(event), {
      title: "Select Java executable",
      properties: ["openFile"],
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });
  ipcMain.handle("settings:test-java", async (event, input: unknown) => {
    trusted(event);
    const value = z
      .object({
        path: z.string().min(1).max(4096).refine(path.isAbsolute),
        major: z.number().int().min(8).max(99),
        preferences: javaPreferencesSchema,
      })
      .parse(input);
    if (value.preferences.memoryMaxMiB * 1024 ** 2 > os.totalmem())
      throw new Error("Configured maximum memory exceeds physical memory.");
    if (!value.preferences.skipCompatibilityChecks)
      await checkJava(value.path, value.major);
    // Test collector/flags with -version, without allocating the configured heap.
    return inspectJava(value.path, presetArguments(value.preferences));
  });
}
