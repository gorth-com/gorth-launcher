import path from "node:path";
import { BrowserWindow } from "electron";
import { getRpcRendererUrl } from "@/main/rpc/sender";
import { installPortal } from "@/main/windows/portal";
const consoles = new Map<string, BrowserWindow>();
const hidden = new WeakSet<BrowserWindow>();
export async function showGameConsole(instanceId: string) {
  const previous = consoles.get(instanceId);
  if (previous && !previous.isDestroyed()) {
    hidden.delete(previous);
    previous.show();
    previous.focus();
    return;
  }
  const window = new BrowserWindow({
    title: "Minecraft Console",
    width: 1000,
    height: 700,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  consoles.set(instanceId, window);
  installPortal(window);
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.once("closed", () => consoles.delete(instanceId));
  const url = new URL(getRpcRendererUrl());
  url.searchParams.set("game-console", instanceId);
  try {
    await window.loadURL(url.href);
    if (!hidden.has(window) && !window.isDestroyed()) window.show();
  } catch {
    window.destroy();
    throw new Error("Could not open game console.");
  }
}
export function hideGameConsole(instanceId: string) {
  const window = consoles.get(instanceId);
  if (window && !window.isDestroyed()) {
    hidden.add(window);
    window.hide();
  }
}
