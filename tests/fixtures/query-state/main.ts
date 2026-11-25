import { app, BrowserWindow } from "electron";
import path from "node:path";
const directory = process.argv.at(-1)!;
if (
  !path.basename(directory).startsWith("gorth-query-state-") ||
  !process.argv.includes("--use-mock-keychain")
)
  throw new Error("An isolated profile and mock Keychain are required");
app.setPath("userData", path.join(directory, "profile"));
app.setPath("sessionData", path.join(directory, "session"));
const timer = setTimeout(() => app.exit(1), 20000);
void app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  window.webContents.on("console-message", (details) =>
    console.log(details.message),
  );
  try {
    await window.loadFile(path.join(directory, "index.html"));
    const result = await window.webContents.executeJavaScript(
      "window.queryStateTest",
    );
    console.log("GORTH_QUERY_STATE=" + JSON.stringify(result));
    clearTimeout(timer);
    window.destroy();
    app.quit();
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
