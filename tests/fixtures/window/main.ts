import path from "node:path";
import { writeFile } from "node:fs/promises";
import { app, BrowserWindow } from "electron";
import { createServer, type Server } from "node:http";
import { installDevelopmentLifecycle } from "@/main/services/development-lifecycle";

const profile = process.argv.at(-1);
if (
  !profile ||
  !path.isAbsolute(profile) ||
  path.basename(profile) !== "profile"
)
  throw new Error("A dedicated smoke-test profile is required.");
app.setPath("userData", profile);
app.setPath("sessionData", profile);
const mode =
  process.argv
    .find((value) => value.startsWith("--smoke-mode="))
    ?.split("=")[1] ?? "close";
const errors: string[] = [];

const timer = setTimeout(() => {
  errors.push("Window smoke test timed out.");
  console.error("Window smoke test timed out.");
  app.quit();
}, 25_000);

void (async () => {
  let window: BrowserWindow | undefined;
  let server: Server | undefined;
  let result: Record<string, unknown> | undefined;
  const graceful = { beforeQuit: false, willQuit: false };
  // Control shutdown explicitly on every OS, including when the last window closes.
  app.on("window-all-closed", () => {});
  app.once("before-quit", () => {
    graceful.beforeQuit = true;
  });
  app.once("will-quit", () => {
    graceful.willQuit = true;
    clearTimeout(timer);
    server?.close();
  });
  const quitting = new Promise<void>((resolve) => {
    app.once("quit", (_event, code) => {
      console.log(
        "GORTH_WINDOW_SMOKE=" +
          JSON.stringify({
            ...result,
            closed: window?.isDestroyed() ?? false,
            graceful,
            errors,
            exitCode: code,
          }),
      );
      resolve();
    });
  });
  try {
    await app.whenReady();
    if (mode !== "close") {
      server = createServer((_request, response) => response.end());
      await new Promise<void>((resolve) =>
        server!.listen(0, "127.0.0.1", resolve),
      );
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("No dev server address.");
      installDevelopmentLifecycle(`http://127.0.0.1:${address.port}`);
    }
    const shown = new Promise<void>((resolve) => {
      app.once("browser-window-created", (_event, created) => {
        window = created;
        created.once("show", resolve);
        created.webContents.on("preload-error", (_event, _file, error) =>
          errors.push(error.message),
        );
        created.webContents.on("render-process-gone", (_event, details) =>
          errors.push(`Renderer exited: ${details.reason}`),
        );
      });
    });
    const { createWindow } = await import("@/main/windows/capital");
    createWindow();
    await shown;
    if (!window) throw new Error("The factory did not create a window.");
    if (window.webContents.isLoading())
      await new Promise<void>((resolve) =>
        window!.webContents.once("did-finish-load", resolve),
      );
    const renderer = await window.webContents.executeJavaScript(`({
      loaded: document.querySelector('[data-window-smoke]')?.textContent === 'Window smoke fixture',
      bridge: typeof window.electronAPI?.rpc?.request === 'function',
      nodeHidden: typeof require === 'undefined' && typeof process === 'undefined',
      contextIsolation: window.windowSmokeTest.contextIsolation,
      sandbox: window.windowSmokeTest.sandbox
    })`);
    result = {
      title: window.getTitle(),
      visible: window.isVisible(),
      width: window.getBounds().width,
      height: window.getBounds().height,
      url: window.webContents.getURL(),
      contextIsolation: renderer.contextIsolation,
      sandbox: renderer.sandbox,
      renderer,
      errors,
      reused:
        createWindow() === window && BrowserWindow.getAllWindows().length === 1,
      closed: false,
    };
    if (mode === "close") {
      const closed = new Promise<void>((resolve) =>
        window!.once("closed", resolve),
      );
      window.close();
      await closed;
      app.quit();
    } else if (mode === "SIGINT" || mode === "SIGTERM") {
      process.kill(process.pid, mode);
    } else if (mode === "server-stop") {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    } else if (mode === "parent-stop" || mode === "parent-kill") {
      await writeFile(path.join(profile, `ready-${mode}`), "ready");
    } else {
      throw new Error("Unknown window smoke mode.");
    }
    await quitting;
  } catch (error) {
    errors.push(String(error));
    console.error(error);
    app.quit();
  } finally {
    clearTimeout(timer);
    server?.close();
  }
})();
