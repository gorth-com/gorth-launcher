import path from "node:path";
import { app, BrowserWindow, ipcMain } from "electron";
import { showGameConsole } from "@/main/services/game-presentation";
import { getRpcRendererUrl } from "@/main/rpc/sender";
const directory = process.argv.at(-1)!;
if (
  !path.isAbsolute(directory) ||
  !path.basename(directory).startsWith("gorth-game-settings-")
)
  throw new Error("Isolated profile required");
app.setPath("userData", path.join(directory, "profile"));
app.setPath("sessionData", path.join(directory, "profile"));
const errors: string[] = [];
const result: Record<string, unknown> = {};
const timer = setTimeout(() => {
  errors.push("Timeout");
  app.quit();
}, 12000);
app.once("quit", () => {
  clearTimeout(timer);
  console.log("GORTH_GAME_SETTINGS=" + JSON.stringify({ errors, result }));
});
void (async () => {
  try {
    await app.whenReady();
    const window = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: path.join(directory, "main/preload.cjs"),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    await window.loadURL(getRpcRendererUrl());
    const request = async (id: string) => {
      const delivered = new Promise<string>((resolve) =>
        ipcMain.once("fixture:console", (_event, value) => resolve(value)),
      );
      await showGameConsole(id, window);
      return delivered;
    };
    result.instance = await request("fixture-instance");
    result.visible = window.isVisible();
    // Electron exposes this inspection method at runtime, but not in its public types.
    const preferences = (
      window.webContents as typeof window.webContents & {
        getLastWebPreferences(): Electron.WebPreferences;
      }
    ).getLastWebPreferences();
    result.secure =
      preferences.contextIsolation &&
      preferences.sandbox &&
      !preferences.nodeIntegration;
    await request("second-instance");
    result.reused = BrowserWindow.getAllWindows().length === 1;
    window.hide();
    result.hidden = !window.isVisible();
    await request("fixture-instance");
    result.restored = window.isVisible();
    window.destroy();
  } catch (error) {
    errors.push(String(error));
  } finally {
    app.quit();
  }
})();
