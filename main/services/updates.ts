import { requestConfirmation } from "@/main/services/confirmation";
import { updateRepository } from "@/utils/constant";
import {
  app,
  autoUpdater,
  BrowserWindow,
  ipcMain,
  shell,
  type IpcMainInvokeEvent,
} from "electron";
import { existsSync } from "node:fs";
import path from "node:path";
import { createUpdateController } from "@/main/services/update-controller";
import { getRpcRendererUrl, isRpcRendererUrl } from "@/main/rpc/sender";

import { releaseVersion } from "@gorth-com/structure/modules/desktop";
import { cancelAuth } from "@/lib/auth/service";
import { gameIsBusy } from "@/lib/game/service";

function trusted(event: IpcMainInvokeEvent) {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (
    !window ||
    window.webContents !== event.sender ||
    !event.senderFrame ||
    event.senderFrame !== event.sender.mainFrame ||
    !isRpcRendererUrl(event.senderFrame.url, getRpcRendererUrl())
  )
    throw new Error("Untrusted updater sender");
  return window;
}
export function registerUpdateIpc() {
  const firstRunUntil = process.argv.includes("--squirrel-firstrun")
    ? Date.now() + 10_000
    : 0;
  const disabledReason = !app.isPackaged
    ? "Auto-update chỉ hoạt động trong bản đã đóng gói; không cập nhật bản dev."
    : !["darwin", "win32"].includes(process.platform)
      ? "Hệ điều hành này cần tải bản mới thủ công hoặc cập nhật qua trình quản lý gói."
      : !releaseVersion(app.getVersion())
        ? "Bản này không thuộc kênh phát hành stable."
        : process.platform === "win32" &&
            !existsSync(
              path.resolve(path.dirname(process.execPath), "..", "Update.exe"),
            )
          ? "Cần cài ứng dụng bằng bộ cài Squirrel để dùng auto-update."
          : undefined;
  let owner: BrowserWindow | undefined;
  const controller = createUpdateController({
    version: app.getVersion(),
    ...updateRepository,
    platform: process.platform,
    arch: process.arch,
    disabledReason,
    driver: autoUpdater,
    fetch: desktopFetch,
    confirmInstall: async () => {
      if (gameIsBusy()) throw new Error("Game or content task is busy");
      if (!owner || owner.isDestroyed()) return false;
      if (
        !(await requestConfirmation(owner, {
          title: "Khởi động lại để cài bản cập nhật?",
          description: "Hãy lưu công việc trước khi tiếp tục.",
          confirmLabel: "Khởi động lại để cập nhật",
          cancelLabel: "Để sau",
        }))
      )
        return false;
      if (gameIsBusy()) throw new Error("A game task started while confirming");
      cancelAuth();
      return true;
    },
  });
  const releaseUrl =
    "https://github.com/" +
    updateRepository.owner +
    "/" +
    updateRepository.repository +
    "/releases";
  const unsubscribe = controller.subscribe((state) => {
    for (const window of BrowserWindow.getAllWindows()) {
      const contents = window.webContents;
      if (
        !contents.isDestroyed() &&
        isRpcRendererUrl(contents.getURL(), getRpcRendererUrl())
      )
        contents.send("update:changed", state);
    }
  });
  ipcMain.handle("update:state", (event) => {
    trusted(event);
    return controller.snapshot();
  });
  ipcMain.handle("update:check", (event) => {
    trusted(event);
    if (Date.now() < firstRunUntil)
      return {
        ...controller.snapshot(),
        message: "Bộ cài đang hoàn tất. Chờ 10 giây rồi kiểm tra lại.",
      };
    return controller.check();
  });
  ipcMain.handle("update:download", (event) => {
    trusted(event);
    return controller.download();
  });
  ipcMain.handle("update:install", async (event) => {
    owner = trusted(event);
    return await controller.install();
  });
  ipcMain.handle("update:releases", async (event) => {
    trusted(event);
    await shell.openExternal(releaseUrl);
  });
  app.once("will-quit", () => {
    unsubscribe();
    controller.dispose();
  });
}
import { desktopFetch } from "@/lib/http/transport";
