import { app, BrowserWindow } from "electron";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const [directory, target] = process.argv.slice(-2);
if (
  !path.isAbsolute(directory) ||
  !path.basename(directory).startsWith("gorth-deno-runtime-")
)
  throw new Error("Isolated profile required");
app.setPath("userData", path.join(directory, "profile"));
app.setPath("sessionData", path.join(directory, "session"));
const errors: string[] = [];
const timer = setTimeout(() => {
  process.exitCode = 1;
  app.quit();
}, 15000);
app.on("quit", () => clearTimeout(timer));
void (async () => {
  try {
    await app.whenReady();
    const window = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    window.webContents.on("console-message", (details) => {
      if (details.level === "error") errors.push(details.message);
    });
    if (target.startsWith("http://127.0.0.1:")) await window.loadURL(target);
    else await window.loadFile(target);
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      ready = await window.webContents.executeJavaScript(
        `!!document.querySelector('#runtime-ready') && !!document.querySelector('[data-slot="alert-dialog-title"]')`,
      );
      if (ready) break;
      await delay(50);
    }
    const height = await window.webContents.executeJavaScript(
      `document.querySelector('#runtime-ready')?.getBoundingClientRect().height`,
    );
    console.log(
      "GORTH_DENO_RUNTIME=" + JSON.stringify({ ready, height, errors }),
    );
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    app.quit();
  }
})();
