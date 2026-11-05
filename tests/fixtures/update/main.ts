import path from "node:path";
import { app, BrowserWindow, ipcMain } from "electron";
import { setTimeout as delay } from "node:timers/promises";
import type { UpdateState } from "@/lib/update/interface";
const directory = process.argv.at(-1);
if (
  !directory ||
  !path.isAbsolute(directory) ||
  !path.basename(directory).startsWith("gorth-update-ui-")
)
  throw new Error("Isolated updater fixture profile required");
app.setPath("userData", path.join(directory, "profile"));
app.setPath("sessionData", path.join(directory, "profile"));
const errors: string[] = [];
const calls: string[] = [];
let complete = false;
const timer = setTimeout(() => {
  errors.push("Updater fixture timed out");
  app.quit();
}, 15000);
app.once("will-quit", () => clearTimeout(timer));
app.once("quit", () =>
  console.log("GORTH_UPDATE_UI=" + JSON.stringify({ errors, calls, complete })),
);
void (async () => {
  try {
    await app.whenReady();
    const window = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: path.join(directory, "preload.cjs"),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    let state: UpdateState = {
      version: "1.0.0",
      status: "idle",
      message: "Ready",
    };
    ipcMain.handle("update:state", () => state);
    ipcMain.handle("update:check", () => {
      calls.push("check");
      state = {
        ...state,
        status: "available",
        availableVersion: "1.1.0",
        message: "Available",
      };
      return state;
    });
    ipcMain.handle("update:download", async () => {
      calls.push("download");
      const stale = { ...state, status: "downloading", message: "Downloading" };
      state = { ...state, status: "downloaded", message: "Downloaded" };
      window.webContents.send("update:changed", state);
      await delay(100);
      return stale;
    });
    ipcMain.handle("update:install", () => {
      calls.push("install");
      state = { ...state, status: "installing", message: "Installing" };
      return state;
    });
    ipcMain.handle("update:releases", () => {
      calls.push("releases");
    });
    window.webContents.on("console-message", (details) => {
      if (details.level === "error") errors.push(details.message);
    });
    window.webContents.on("render-process-gone", (_event, details) =>
      errors.push(details.reason),
    );
    await window.loadFile(path.join(directory, "renderer/index.html"));
    const run = (script: string) =>
      window.webContents.executeJavaScript(script);
    const wait = async (label: string) => {
      const until = Date.now() + 4000;
      while (
        !(await run(
          '!![...document.querySelectorAll("button")].find(el=>el.textContent===' +
            JSON.stringify(label) +
            "&&!el.disabled)",
        ))
      ) {
        if (Date.now() > until)
          throw new Error("Missing enabled button: " + label);
        await delay(25);
      }
    };
    const click = async (label: string) => {
      await wait(label);
      await run(
        '[...document.querySelectorAll("button")].find(el=>el.textContent===' +
          JSON.stringify(label) +
          ").click()",
      );
    };
    await wait("Kiểm tra cập nhật");
    if (!(await run('document.body.textContent.includes("1.0.0")')))
      throw new Error("Missing installed version");
    await click("GitHub Releases");
    await click("Kiểm tra cập nhật");
    await click("Tải bản mới");
    await wait("Khởi động lại để cập nhật");
    await delay(200);
    await click("Khởi động lại để cập nhật");
    const until = Date.now() + 4000;
    while (!(await run('document.body.textContent.includes("Installing")'))) {
      if (Date.now() > until) throw new Error("Missing install state");
      await delay(25);
    }
    complete = true;
  } catch (error) {
    errors.push(String(error));
  } finally {
    app.quit();
  }
})();
