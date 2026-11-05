import { app, BrowserWindow } from "electron";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
const directory = process.argv.at(-1)!;
if (
  !path.isAbsolute(directory) ||
  !path.basename(directory).startsWith("gorth-error-toast-")
)
  throw new Error("Isolated profile required");
app.setPath("userData", path.join(directory, "profile"));
app.setPath("sessionData", path.join(directory, "profile"));
const errors: string[] = [];
const result: Record<string, unknown> = {};
const timer = setTimeout(() => {
  errors.push("Toast fixture timed out");
  app.quit();
}, 15000);
app.once("quit", () => {
  clearTimeout(timer);
  console.log("GORTH_ERROR_TOAST=" + JSON.stringify({ errors, result }));
});
void (async () => {
  try {
    await app.whenReady();
    const window = new BrowserWindow({
      show: false,
      width: 1100,
      height: 800,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    const portals: BrowserWindow[] = [];
    window.webContents.setWindowOpenHandler(({ url }) =>
      url === "about:blank"
        ? {
            action: "allow",
            overrideBrowserWindowOptions: {
              show: false,
              webPreferences: {
                sandbox: true,
                contextIsolation: true,
                nodeIntegration: false,
              },
            },
          }
        : { action: "deny" },
    );
    window.webContents.on("did-create-window", (child) => portals.push(child));
    window.webContents.on("console-message", (details) => {
      if (details.level === "error") errors.push(details.message);
    });
    await window.loadFile(path.join(directory, "renderer/index.html"));
    const run = (source: string) =>
      window.webContents.executeJavaScript(source);
    const click = (text: string) =>
      run(
        `Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim() === ${JSON.stringify(text)})?.click()`,
      );
    const wait = async (check: () => Promise<boolean>) => {
      const end = Date.now() + 4000;
      while (!(await check())) {
        if (Date.now() > end) throw new Error("Toast UI did not settle");
        await delay(25);
      }
    };
    const hasToast = async (message: string) => {
      for (const child of portals)
        if (
          !child.isDestroyed() &&
          (await child.webContents.executeJavaScript(
            `document.body.textContent.includes(${JSON.stringify(message)})`,
          ))
        )
          return true;
      return false;
    };
    await wait(() =>
      run("document.body.textContent.includes('Gorth Browser')"),
    );
    await run(
      "Array.from(document.querySelectorAll('label')).find(el => el.textContent.trim() === 'Gorth Browser').click()",
    );
    await wait(() => hasToast("Fixture save failed"));
    result.portal = true;
    result.inline = await run(
      "document.body.textContent.includes('Fixture save failed')",
    );
    await click("Repeat render");
    await click("Repeat render");
    await delay(100);
    let count = 0;
    for (const child of portals)
      if (!child.isDestroyed())
        count += await child.webContents.executeJavaScript(
          "Array.from(document.querySelectorAll('[data-slot=toast-title]')).filter(el => el.textContent === 'Fixture save failed').length",
        );
    result.toastCount = count;
    await click("Fail startup");
    await wait(() => hasToast("Fixture database unavailable"));
    result.startupPortal = true;
    result.startupInline = await run(
      "document.body.textContent.includes('Fixture database unavailable')",
    );
    result.retry = await run("document.body.textContent.includes('Try again')");
  } catch (error) {
    errors.push(String(error));
  } finally {
    app.quit();
  }
})();
