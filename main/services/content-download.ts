import { app, BrowserWindow, session, type DownloadItem } from "electron";
import { copyFile, mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ContentFile } from "@/lib/content/interface";
import { allowedContentWebsite } from "@/lib/content/website";
import { digest } from "@/lib/game/files";

export function allowedWebsiteArtifact(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      [
        "www.curseforge.com",
        "edge.forgecdn.net",
        "mediafilez.forgecdn.net",
      ].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

export async function downloadWebsiteFile(
  file: ContentFile,
  target: string,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  if (
    !file.websiteDownload ||
    !allowedContentWebsite(file.websiteDownload) ||
    !file.websiteDownload.startsWith("https://www.curseforge.com/") ||
    !file.artifact.sha1 ||
    !/^[a-f0-9]{40}$/.test(file.artifact.sha1) ||
    !Number.isSafeInteger(file.artifact.size) ||
    file.artifact.size! <= 0 ||
    file.artifact.size! > 1024 ** 3
  )
    throw new Error("Thông tin file tải từ website không hợp lệ.");

  const temps = path.join(app.getPath("userData"), "temps");
  await mkdir(temps, { recursive: true });
  const temporary = await mkdtemp(path.join(temps, "curseforge-"));
  const downloaded = path.join(temporary, "artifact.part");
  const isolated = session.fromPartition("blocked-content-" + randomUUID());
  isolated.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false),
  );
  isolated.setPermissionCheckHandler(() => false);
  const window = new BrowserWindow({
    show: false,
    width: 1000,
    height: 760,
    title: "CurseForge — xác nhận tải file",
    webPreferences: {
      session: isolated,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-attach-webview", (event) =>
    event.preventDefault(),
  );
  const guard = (event: Electron.Event, url: string) => {
    if (!allowedWebsiteArtifact(url)) event.preventDefault();
  };
  window.webContents.on("will-navigate", guard);
  window.webContents.on("will-redirect", guard);
  let item: DownloadItem | undefined;
  let downloading = false;
  let stop: (() => void) | undefined;
  let listener:
    | ((
        event: Electron.Event,
        download: DownloadItem,
        source: Electron.WebContents,
      ) => void)
    | undefined;
  let reveal: ReturnType<typeof setTimeout> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        if (error) reject(error);
        else resolve();
      };
      stop = () => finish(new Error("Đã hủy tải mod từ website."));
      signal.addEventListener("abort", stop, { once: true });
      app.once("before-quit", stop);
      window.once("closed", stop);
      window.webContents.once("render-process-gone", () =>
        finish(new Error("Trang tải mod đã dừng.")),
      );
      listener = (event, download, source) => {
        if (
          source !== window.webContents ||
          item ||
          !download.getURLChain().every(allowedWebsiteArtifact) ||
          !allowedWebsiteArtifact(download.getURL())
        ) {
          event.preventDefault();
          return;
        }
        item = download;
        downloading = true;
        clearTimeout(reveal);
        download.setSavePath(downloaded);
        download.on("updated", () => {
          if (
            download.getReceivedBytes() > file.artifact.size! ||
            download.getTotalBytes() > file.artifact.size!
          ) {
            finish(new Error("File website vượt kích thước đã công bố."));
            download.cancel();
          }
        });
        download.once("done", (_event, state) => {
          finish(
            state === "completed"
              ? undefined
              : new Error("Tải mod từ website bị gián đoạn."),
          );
        });
      };
      isolated.on("will-download", listener);
      // Use only the official download page. No CDN URL fabrication or challenge bypass.
      reveal = setTimeout(() => {
        if (!downloading && !window.isDestroyed()) window.show();
      }, 20_000);
      timeout = setTimeout(
        () => finish(new Error("Hết thời gian chờ tải mod từ website.")),
        5 * 60_000,
      );
      void window
        .loadURL(file.websiteDownload!)
        .catch((error: Error & { code?: string }) => {
          // A navigation handed to Chromium's download manager can report ERR_ABORTED.
          if (error.code !== "ERR_ABORTED")
            finish(new Error("Không mở được trang tải CurseForge."));
        });
      if (signal.aborted) stop();
    });
    signal.throwIfAborted();
    if (
      (await stat(downloaded)).size !== file.artifact.size ||
      (await digest(downloaded, "sha1")) !== file.artifact.sha1
    )
      throw new Error("File tải từ website sai checksum hoặc kích thước.");
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(downloaded, target);
    signal.throwIfAborted();
  } finally {
    clearTimeout(reveal);
    clearTimeout(timeout);
    if (stop) signal.removeEventListener("abort", stop);
    if (stop) app.removeListener("before-quit", stop);
    if (listener) isolated.removeListener("will-download", listener);
    if (item && item.getState() === "progressing") item.cancel();
    if (!window.isDestroyed()) window.destroy();
    await rm(temporary, { recursive: true, force: true });
  }
}
