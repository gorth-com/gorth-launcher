import { BrowserWindow } from "electron";
import { getRpcRendererUrl, isRpcRendererUrl } from "@/main/rpc/sender";

export async function showGameConsole(
  instanceId: string,
  owner?: BrowserWindow | null,
) {
  const trusted = (window: BrowserWindow) =>
    !window.isDestroyed() &&
    isRpcRendererUrl(window.webContents.getURL(), getRpcRendererUrl());
  const window =
    owner && trusted(owner)
      ? owner
      : BrowserWindow.getAllWindows().find(trusted);
  if (!window) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
  window.webContents.send("game:open-console", instanceId);
}
