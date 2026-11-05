import path from "node:path";
import { app, BrowserWindow } from "electron";
import {
  showGameConsole,
  hideGameConsole,
} from "@/main/services/game-presentation";
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
    await showGameConsole("fixture-instance");
    const window = BrowserWindow.getAllWindows()[0];
    result.visible = window.isVisible();
    result.instance = new URL(window.webContents.getURL()).searchParams.get(
      "game-console",
    );
    // Electron exposes this inspection method at runtime, but not in its public types.
    const preferences = (window.webContents as typeof window.webContents & {
      getLastWebPreferences(): Electron.WebPreferences;
    }).getLastWebPreferences();
    result.secure =
      preferences.contextIsolation &&
      preferences.sandbox &&
      !preferences.nodeIntegration;
    await showGameConsole("fixture-instance");
    result.reused = BrowserWindow.getAllWindows().length === 1;
    hideGameConsole("fixture-instance");
    result.hidden = !window.isVisible();
    await showGameConsole("fixture-instance");
    result.restored = window.isVisible();
    window.destroy();
  } catch (error) {
    errors.push(String(error));
  } finally {
    app.quit();
  }
})();
