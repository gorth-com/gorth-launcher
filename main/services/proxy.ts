import path from "node:path";
import { readFile, writeFile, rename } from "node:fs/promises";
import {
  app,
  BrowserWindow,
  ipcMain,
  safeStorage,
  session,
  webContents,
  type Session,
} from "electron";
import { z } from "@gorth-io/structure/cores/zod";
import {
  defaultProxySettings,
  electronProxyConfig,
  proxySettingsSchema,
  proxyUpdateSchema,
  type ProxyView,
} from "@/lib/network/proxy";
import { installDesktopFetch } from "@/lib/http/transport";
import { createNetworkFetch } from "@/main/services/network-fetch";
import { getRpcRendererUrl, isRpcRendererUrl } from "@/main/rpc/sender";

const storedSchema = z.object({
  settings: proxySettingsSchema,
  encryptedCredentials: z.string().max(32768).optional(),
});
export async function initializeNetworkProxy(partitions: string[] = []) {
  const file = path.join(app.getPath("userData"), "network-proxy.json");
  let stored: z.infer<typeof storedSchema> = { settings: defaultProxySettings };
  try {
    stored = storedSchema.parse(JSON.parse(await readFile(file, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT")
      throw new Error(
        "Cannot read saved proxy settings. No network connection was started.",
      );
  }
  const sessions = new Set<Session>();
  const attach = (target: Session) => {
    sessions.add(target);
    return target.setProxy(electronProxyConfig(stored.settings));
  };
  app.on("session-created", (target) => {
    void attach(target).catch(() => {
      // Fail closed: a newly created session must not silently bypass the proxy.
      void target.setProxy({
        mode: "fixed_servers",
        proxyRules: "http://127.0.0.1:1",
      });
    });
  });
  await attach(session.defaultSession);
  // Known partitions must be ready BEFORE a webview is allowed to navigate.
  for (const partition of partitions)
    await attach(session.fromPartition(partition));
  for (const contents of webContents.getAllWebContents())
    await attach(contents.session);
  const network = session.fromPartition("gorth-network", { cache: false });
  await attach(network);
  installDesktopFetch(createNetworkFetch(network));

  app.on("login", (event, _contents, _request, info, callback) => {
    if (!info.isProxy || stored.settings.mode === "system") return;
    event.preventDefault();
    const settings = stored.settings;
    if (
      settings.mode !== "http" ||
      !stored.encryptedCredentials ||
      info.host.toLowerCase() !==
        settings.host.replace(/^\[|\]$/g, "").toLowerCase() ||
      info.port !== settings.port
    ) {
      callback();
      return;
    }
    try {
      const credentials = z
        .object({ username: z.string(), password: z.string() })
        .parse(
          JSON.parse(
            safeStorage.decryptString(
              Buffer.from(stored.encryptedCredentials, "base64"),
            ),
          ),
        );
      callback(credentials.username, credentials.password);
    } catch {
      callback();
    }
  });
  const view = (): ProxyView => ({
    ...stored.settings,
    hasCredentials: !!stored.encryptedCredentials,
  });
  let pending = Promise.resolve();
  const save = (input: unknown) => {
    const update = proxyUpdateSchema.parse(input);
    const operation = pending.then(async () => {
      const previous = stored;
      const sameEndpoint =
        update.settings.mode === previous.settings.mode &&
        update.settings.host === previous.settings.host &&
        update.settings.port === previous.settings.port;
      let encryptedCredentials =
        sameEndpoint && !update.clearCredentials
          ? previous.encryptedCredentials
          : undefined;
      if (update.credentials) {
        if (
          !safeStorage.isEncryptionAvailable() ||
          (process.platform === "linux" &&
            safeStorage.getSelectedStorageBackend() === "basic_text")
        )
          throw new Error(
            "A secure system keychain is required to save proxy credentials.",
          );
        encryptedCredentials = safeStorage
          .encryptString(JSON.stringify(update.credentials))
          .toString("base64");
      }
      if (update.settings.mode !== "http") encryptedCredentials = undefined;
      stored = { settings: update.settings, encryptedCredentials };
      try {
        await Promise.all(
          [...sessions].map((target) =>
            target.setProxy(electronProxyConfig(stored.settings)),
          ),
        );
        await writeFile(file + ".tmp", JSON.stringify(stored), { mode: 0o600 });
        await rename(file + ".tmp", file);
      } catch {
        stored = previous;
        await Promise.all(
          [...sessions].map((target) =>
            target.setProxy(electronProxyConfig(previous.settings)),
          ),
        );
        throw new Error(
          "Could not apply proxy settings. Previous configuration restored.",
        );
      }
      await Promise.all(
        [...sessions].map(async (target) => {
          // Removing credentials must also discard Chromium's cached proxy auth.
          await target.clearAuthCache();
          await target.closeAllConnections();
        }),
      );
      return view();
    });
    pending = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  };
  function trusted(event: Electron.IpcMainInvokeEvent) {
    const owner = BrowserWindow.fromWebContents(event.sender);
    if (
      !owner ||
      owner.webContents !== event.sender ||
      event.senderFrame !== event.sender.mainFrame ||
      !isRpcRendererUrl(event.sender.getURL(), getRpcRendererUrl())
    )
      throw new Error("Untrusted network settings request.");
  }
  ipcMain.handle("network-proxy:get", (event) => {
    trusted(event);
    return view();
  });
  ipcMain.handle("network-proxy:save", (event, input: unknown) => {
    trusted(event);
    return save(input);
  });
  ipcMain.handle("network-proxy:route", async (event) => {
    trusted(event);
    await pending;
    // Diagnostics only; never accept an arbitrary renderer-supplied destination.
    return network.resolveProxy("https://example.com/");
  });
  return { view, save, network, prepareSession: attach };
}
