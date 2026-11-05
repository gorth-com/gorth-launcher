import { app, BrowserWindow } from "electron";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
const directory = process.argv.at(-1)!;
if (
  !path.isAbsolute(directory) ||
  !path.basename(directory).startsWith("gorth-folders-native-")
)
  throw new Error("Isolated profile required");
app.setPath("userData", path.join(directory, "profile"));
app.setPath("sessionData", path.join(directory, "profile"));
const errors: string[] = [];
let result: unknown;
const timer = setTimeout(() => app.exit(1), 12000);
app.once("quit", () => {
  clearTimeout(timer);
  console.log("GORTH_FOLDERS=" + JSON.stringify({ errors, result }));
});
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
    await window.loadFile(path.join(directory, "renderer/index.html"));
    const run = (code: string) => window.webContents.executeJavaScript(code);
    async function wait(code: string) {
      const until = Date.now() + 4000;
      while (!(await run(code))) {
        if (Date.now() > until) throw new Error("Folders UI did not settle");
        await delay(30);
      }
    }
    await wait(
      '!!document.querySelector("input[aria-label=\\"Downloads path\\"]")',
    );
    await run(
      'document.querySelector("input[aria-label=\\"Application path\\"]").click()',
    );
    await run(
      'document.querySelector("input[aria-label=\\"Downloads path\\"]").click()',
    );
    await wait(
      'document.querySelector("input[aria-label=\\"Downloads path\\"]").value === "/fixture/selected"',
    );
    await run('[...document.querySelectorAll("button")].at(-1).click()');
    await wait('window.folderCalls.includes("open:downloads")');
    result = await run(`({
      calls: window.folderCalls,
      readOnly: [...document.querySelectorAll("input")].every(input => input.readOnly),
      updated: document.querySelector('input[aria-label="Downloads path"]').value,
      restart: document.body.textContent.includes("After restart"),
      primitiveInput: document.querySelector('input[aria-label="Downloads path"]').getAttribute("data-slot"),
    })`);
    window.destroy();
  } catch (error) {
    errors.push(String(error));
  } finally {
    app.quit();
  }
})();
