import path from "node:path";
import { app, BrowserWindow, ipcMain } from "electron";
import { searchContent } from "@/lib/content/providers";
import { setTimeout as delay } from "node:timers/promises";

const directory = process.argv.at(-1)!;
if (
  !path.isAbsolute(directory) ||
  !path.basename(directory).startsWith("gorth-content-avatar-")
)
  throw new Error("Isolated profile required");
app.setPath("userData", path.join(directory, "profile"));
app.setPath("sessionData", path.join(directory, "profile"));
const timer = setTimeout(() => app.exit(1), 20000);
void (async () => {
  try {
    await app.whenReady();
    ipcMain.handle("avatar-test:search", async () => {
      const result = await searchContent(
        {
          provider: "modrinth",
          kind: "mod",
          query: "jei",
          loader: "Forge",
          version: "1.20.1",
          offset: 0,
          limit: 10,
        },
        AbortSignal.timeout(12000),
      );
      if (!result.projects[0])
        throw new Error("Live search returned no projects");
      return result.projects[0];
    });
    const window = new BrowserWindow({
      show: false,
      width: 1280,
      height: 1000,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(directory, "preload.cjs"),
      },
    });
    const failures: unknown[] = [];
    window.webContents.session.webRequest.onErrorOccurred((details) =>
      failures.push({ url: details.url, error: details.error }),
    );
    await window.webContents.session.protocol.handle("https", (request) => {
      if (new URL(request.url).hostname === "avatar.fixture.test")
        return new Response(
          '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="green"/></svg>',
          { headers: { "Content-Type": "image/svg+xml" } },
        );
      return window.webContents.session.fetch(request, {
        bypassCustomProtocolHandlers: true,
      });
    });
    const rendererUrl = process.argv.at(-2);
    if (rendererUrl?.startsWith("http://127.0.0.1:"))
      await window.loadURL(rendererUrl);
    else await window.loadFile(path.join(directory, "renderer/index.html"));
    await delay(14000);
    const result = await window.webContents
      .executeJavaScript(`Array.from(document.querySelectorAll('[data-slot="avatar"]')).map(root => {
      const img=root.querySelector('img'); const box=root.getBoundingClientRect();
      return { image: !!img, src: img?.getAttribute('src'), complete: img?.complete, naturalWidth: img?.naturalWidth, width:box.width,height:box.height, imageWidth: img?.getBoundingClientRect().width,imageHeight:img?.getBoundingClientRect().height };
    })`);
    console.log("GORTH_CONTENT_AVATAR=" + JSON.stringify({ result, failures }));
    window.destroy();
    app.quit();
  } catch (error) {
    console.error(error);
    app.exit(1);
  } finally {
    clearTimeout(timer);
  }
})();
