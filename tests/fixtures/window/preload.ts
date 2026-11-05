import "@/app/preload";
import { contextBridge } from "electron";

// Observe security in the real preload without adding test APIs to the app.
contextBridge.exposeInMainWorld("windowSmokeTest", {
  contextIsolation: process.contextIsolated,
  sandbox: process.sandboxed,
});
