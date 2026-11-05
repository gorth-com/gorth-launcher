import { app, BrowserWindow } from "electron";
import { get } from "node:http";
import path from "node:path";
import { appUrl } from "@/utils/environment";
import { getDesktopPipe } from "@/lib/server/pipe";
import { getRpcRendererUrl, isRpcRendererUrl } from "@/main/rpc/sender";
import {
  startDesktopServer,
  stopDesktopServer,
} from "@/services/desktop-server";

const directory = process.argv[2];
if (
  !directory ||
  !path.isAbsolute(directory) ||
  !path.basename(directory).startsWith("gorth-dev-startup-")
)
  throw new Error("An isolated startup directory is required.");
app.setPath("userData", path.join(directory, "profile"));
app.setPath("sessionData", path.join(directory, "profile"));
const errors: string[] = [];
let loaded = false;
const timer = setTimeout(() => {
  errors.push("Startup timed out.");
  app.quit();
}, 15_000);
app.once("will-quit", () => {
  clearTimeout(timer);
  stopDesktopServer();
});
app.once("quit", () =>
  console.log("GORTH_DEV_STARTUP=" + JSON.stringify({ loaded, errors })),
);
async function run() {
  try {
    await app.whenReady();
    if (app.getAppPath() !== directory)
      throw new Error("The fixture must own its IPC endpoint.");
    await startDesktopServer(true, directory, () => null);
    const health = await new Promise<number | undefined>((resolve, reject) => {
      const request = get(
        {
          socketPath: getDesktopPipe(directory).path,
          path: "/health",
          headers: { Host: new URL(appUrl).host },
        },
        (response) => {
          response.resume();
          resolve(response.statusCode);
        },
      );
      request.once("error", reject);
    });
    if (health !== 200) throw new Error("The desktop server is not healthy.");
    const window = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    window.webContents.on("render-process-gone", (_event, details) =>
      errors.push(details.reason),
    );
    await window.loadURL(getRpcRendererUrl());
    loaded =
      isRpcRendererUrl(window.webContents.getURL(), getRpcRendererUrl()) &&
      (await window.webContents.executeJavaScript(
        "document.querySelector('h1')?.textContent === 'Dev startup fixture'",
      ));
    window.close();
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Startup failed.");
  } finally {
    app.quit();
  }
}
void run();
