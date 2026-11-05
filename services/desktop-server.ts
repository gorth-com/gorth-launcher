import { createServer } from "node:http";
import { H3, toNodeHandler } from "nitro/h3";
import { app, BrowserWindow, ipcMain } from "electron";
import { randomBytes } from "node:crypto";
import { chmod, lstat, mkdir, unlink } from "node:fs/promises";
import { connect } from "node:net";
import { appUrl } from "@/utils/environment";
import { getDesktopPipe } from "@/lib/server/pipe";
import { createDesktopHandler } from "@/lib/server/handler";
import { getAccountProfile } from "@/services/account";

let server: ReturnType<typeof createServer> | null = null;
async function removeStalePipe(filename: string) {
  const info = await lstat(filename).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (!info) return;
  if (!info.isSocket() || info.uid !== process.getuid?.())
    throw new Error("Endpoint IPC không an toàn.");
  const active = await new Promise<boolean>((resolve, reject) => {
    const socket = connect(filename);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", (error: NodeJS.ErrnoException) => {
      socket.destroy();
      if (["ECONNREFUSED", "ENOENT"].includes(error.code ?? "")) resolve(false);
      else reject(error);
    });
    socket.setTimeout(1000, () => {
      socket.destroy();
      reject(new Error("Không kiểm tra được IPC."));
    });
  });
  if (active) throw new Error("Desktop server đang chạy cho dự án này.");
  // Only an owned, verified-dead socket is removed; never delete an arbitrary path.
  await unlink(filename).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
}
export async function startDesktopServer(
  development: boolean,
  rendererDirectory: string,
  getIdentityId: () => string | null,
) {
  if (server) return;
  let origin: URL;
  try {
    origin = new URL(appUrl);
  } catch {
    throw new Error(
      "Thiếu hoặc sai VITE_PUBLIC_APP_URL. Đối chiếu .env.example và khởi động lại app.",
    );
  }
  if (
    origin.protocol !== "http:" ||
    !["localhost", "127.0.0.1"].includes(origin.hostname) ||
    !origin.port ||
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    origin.pathname !== "/"
  )
    throw new Error(
      "VITE_PUBLIC_APP_URL phải là HTTP loopback với port cố định.",
    );
  const capability = randomBytes(32).toString("base64url");
  const routes = createDesktopHandler({
    applicationDirectory: app.getAppPath(),
    rendererDirectory,
    development,
    origin: origin.origin,
    capability,
    getIdentityId,
  });
  const transport = new H3().all("/**", (event) => routes.fetch(event.req));
  const listener = createServer(toNodeHandler(transport));
  const pipe = getDesktopPipe(app.getAppPath());
  if (development && pipe.directory) {
    await mkdir(pipe.directory, { recursive: true, mode: 0o700 });
    const info = await lstat(pipe.directory);
    if (
      !info.isDirectory() ||
      info.isSymbolicLink() ||
      info.uid !== process.getuid?.()
    )
      throw new Error("Thư mục IPC không an toàn.");
    await chmod(pipe.directory, 0o700);
    await removeStalePipe(pipe.path);
  }
  try {
    await new Promise<void>((resolve, reject) => {
      listener.once("error", reject);
      if (development) listener.listen(pipe.path, resolve);
      else listener.listen(Number(origin.port), "127.0.0.1", resolve);
    });
  } catch {
    listener.close();
    throw new Error(
      "Không mở được desktop server. Kiểm tra port ứng dụng hoặc IPC đang bị chiếm.",
    );
  }
  server = listener;
  // Capability is available only to the trusted application main frame, never remote views.
  const connection = (event: Electron.IpcMainInvokeEvent) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (
      !window ||
      window.webContents !== event.sender ||
      event.senderFrame !== event.sender.mainFrame
    )
      throw new Error("Untrusted desktop connection request");
    return { origin: origin.origin, capability };
  };
  ipcMain.handle("desktop:connection", connection);
  ipcMain.handle("desktop:profile", (event) => {
    connection(event);
    return getAccountProfile(origin.origin, capability);
  });
}
export function stopDesktopServer() {
  ipcMain.removeHandler("desktop:connection");
  ipcMain.removeHandler("desktop:profile");
  server?.close();
  if (server && "closeAllConnections" in server) server.closeAllConnections();
  server = null;
}
