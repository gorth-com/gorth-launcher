import assert from "node:assert/strict";
import { app, BrowserWindow } from "electron";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
app.setPath(
  "userData",
  mkdtempSync(path.join(tmpdir(), "gorth-native-auth-ui-")),
);
async function run() {
  await app.whenReady();
  const window = new BrowserWindow({
    show: false,
    width: 1280,
    height: 720,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  try {
    const assets = path.resolve("dist/assets");
    const stylesheet = readdirSync(assets).find((name) =>
      /^index-.*\.css$/.test(name),
    )!;
    await window.loadURL(
      "data:text/html;charset=utf-8," +
        encodeURIComponent('<div id="root" style="height:100vh"></div>'),
    );
    await window.webContents.insertCSS(
      readFileSync(path.join(assets, stylesheet), "utf8"),
    );
    await window.webContents.executeJavaScript(
      readFileSync(".vite/auth-screen-renderer.js", "utf8"),
    );
    const evaluate = (source: string) =>
      window.webContents.executeJavaScript(source);
    const wait = async (source: string) => {
      const deadline = Date.now() + 5000;
      while (!(await evaluate(source))) {
        assert(Date.now() < deadline, "UI state did not settle");
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
    };
    await wait(
      'Boolean(document.querySelector("section")) && document.querySelector("section").textContent.includes("trình duyệt")',
    );
    assert(
      await evaluate(
        'document.querySelector("section").textContent.includes("trình duyệt")',
      ),
    );
    assert.equal(
      await evaluate(
        'document.querySelector("section button").getBoundingClientRect().height',
      ),
      36,
    );
    await evaluate('document.querySelector("section button").click()');
    await wait('Boolean(document.querySelector("[data-route]"))');
    assert.equal(await evaluate("window.authUiTest.cancelled"), 1);
    assert.equal(await evaluate("window.authUiTest.returned"), 1);
    await evaluate("window.authUiTest.open()");
    await wait('Boolean(document.querySelector("section button"))');
    await evaluate("window.authUiTest.finish(false)");
    await new Promise((resolve) => setTimeout(resolve, 650));
    assert.equal(
      await evaluate("window.authUiTest.returned"),
      1,
      "Cancellation must not report successful login",
    );
    await evaluate("window.authUiTest.finish(true)");
    await wait('Boolean(document.querySelector("[data-route]"))');
    assert.equal(await evaluate("window.authUiTest.returned"), 2);
    assert.equal(BrowserWindow.getAllWindows().length, 1);
    console.info(
      "Auth UI: system-browser waiting screen, h-9 cancellation, success-only return and no popup passed.",
    );
  } finally {
    window.destroy();
  }
}
async function main() {
  try {
    await run();
    app.quit();
  } catch (error) {
    console.error("Native auth UI failed:", error);
    app.exit(1);
  }
}
void main();
