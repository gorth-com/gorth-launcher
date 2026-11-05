import { BrowserWindow, ipcMain } from "electron";
import type { AuthViewState } from "@/lib/auth/view-types";

const hidden: AuthViewState = {
  visible: false,
  mode: "login",
  loading: false,
  verifying: false,
  error: "",
};
interface PendingView {
  state: AuthViewState;
  tabId?: string;
  cancel: () => void;
}
const entries = new Map<BrowserWindow, PendingView>();
const results = new WeakMap<BrowserWindow, AuthViewState>();
function notify(window: BrowserWindow, state: AuthViewState) {
  if (!window.isDestroyed() && !window.webContents.isDestroyed())
    window.webContents.send("auth:view-changed", { ...state });
}
// Only a waiting screen lives in the renderer. Better Auth opens the system browser.
export function openAuthView(
  window: BrowserWindow,
  controller: AbortController,
  mode: "login" | "register",
) {
  controller.signal.throwIfAborted();
  const cancel = () => controller.abort();
  entries.set(window, { state: { ...hidden, visible: true, mode }, cancel });
  results.delete(window);
  window.once("closed", cancel);
  controller.signal.addEventListener("abort", () => closeAuthView(window), {
    once: true,
  });
  notify(window, entries.get(window)!.state);
}
export function closeAuthView(window: BrowserWindow, completed = false) {
  const entry = entries.get(window);
  if (!entry) return;
  entries.delete(window);
  window.removeListener("closed", entry.cancel);
  const state = { ...hidden, mode: entry.state.mode, completed };
  results.set(window, state);
  notify(window, state);
}
export function isAuthTab(window: BrowserWindow, id: string) {
  return entries.get(window)?.tabId === id;
}
export function cancelAuthTab(window: BrowserWindow, id: string) {
  if (isAuthTab(window, id)) entries.get(window)?.cancel();
}
export function registerAuthViewIpc(
  trusted: (event: Electron.IpcMainInvokeEvent) => BrowserWindow,
) {
  ipcMain.handle("auth:view-state", (event) => {
    const window = trusted(event);
    return entries.get(window)?.state ?? results.get(window) ?? hidden;
  });
  ipcMain.handle("auth:view-tab", (event, id: unknown) => {
    const entry = entries.get(trusted(event));
    if (!entry || typeof id !== "string" || !/^[a-zA-Z0-9-]{1,100}$/.test(id))
      return false;
    entry.tabId = id;
    return true;
  });
  // These layout commands never create or manipulate a privileged web view.
  ipcMain.handle("auth:view-visible", (event) => {
    trusted(event);
  });
  ipcMain.handle("auth:view-bounds", (event) => {
    trusted(event);
  });
  ipcMain.handle("auth:view-reload", (event) => {
    trusted(event);
  });
}
