import { app, BrowserWindow } from "electron";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import {
  createMacAuthHandler,
  registerMacAuthHandler,
} from "@/main/services/macos-auth-handler";

const run = promisify(execFile);
const directory = process.argv[2];
if (
  !directory ||
  !path.isAbsolute(directory) ||
  !path.basename(directory).startsWith("gorth-callback-native-")
)
  throw new Error("An isolated callback fixture directory is required.");
app.setPath("userData", path.join(directory, "profile"));
app.setPath("sessionData", path.join(directory, "profile"));
// Keep the process alive for native handler unregistration and socket cleanup.
app.on("window-all-closed", () => {});
const scheme = "com.gorth.callback-test.p" + process.pid;
const callback = scheme + "://auth/callback#token=isolated-test-code";
const report = {
  windowLoaded: false,
  received: false,
  count: 0,
  errors: [] as string[],
};
let handler: Awaited<ReturnType<typeof createMacAuthHandler>> | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;

async function main() {
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
    await window.loadURL("data:text/html,<h1>Callback native fixture</h1>");
    report.windowLoaded = await window.webContents.executeJavaScript(
      "document.querySelector('h1')?.textContent === 'Callback native fixture'",
    );
    let complete!: () => void;
    const received = new Promise<void>((resolve, reject) => {
      complete = resolve;
      timer = setTimeout(
        () =>
          reject(
            new Error("OS callback did not return to the original process."),
          ),
        20_000,
      );
    });
    // Attach immediately so a timeout cannot become an unhandled rejection.
    void received.catch(() => {});
    handler = await createMacAuthHandler({
      directory,
      name: "Gorth Callback Test",
      scheme,
      onUrl: async (url) => {
        report.count++;
        report.received = url === callback;
        setTimeout(complete, 50); // Let the HTTP response complete before teardown.
        return report.received;
      },
    });
    await registerMacAuthHandler(handler.bundlePath, scheme, handler.bundleId);
    // No -a override: LaunchServices must choose the dedicated test bundle.
    await run("/usr/bin/open", ["-g", callback], { timeout: 10_000 });
    await received;
    window.destroy();
  } catch (error) {
    if (error instanceof Error && error.cause instanceof Error)
      report.errors.push(error.cause.message);
    report.errors.push(
      error instanceof Error ? error.message : "Native callback failed.",
    );
  } finally {
    if (timer) clearTimeout(timer);
    if (handler) {
      try {
        await run(
          "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister",
          ["-u", handler.bundlePath],
          { timeout: 10_000 },
        );
      } catch {
        report.errors.push(
          "Could not unregister the isolated callback fixture.",
        );
      }
      await handler.dispose();
    }
    console.log("GORTH_CALLBACK_NATIVE=" + JSON.stringify(report));
    app.quit();
  }
}
void main();
