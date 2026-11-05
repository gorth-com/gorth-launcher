import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => {
  const nativeListeners = new Map<string, (...args: unknown[]) => void>();
  const frame = { url: "https://renderer.test/public/index.html" };
  const sender = {
    mainFrame: frame,
    getURL: () => frame.url,
    isDestroyed: () => false,
    send: vi.fn(),
  };
  const window = { webContents: sender, isDestroyed: () => false };
  return {
    frame,
    sender,
    window,
    handlers: new Map<string, (event: unknown) => unknown>(),
    hooks: new Map<string, () => void>(),
    packaged: false,
    exists: true,
    fetch: vi.fn(),
    openExternal: vi.fn(),
    dialog: vi.fn(),
    cancelAuth: vi.fn(),
    busy: false,
    nativeListeners,
    native: {
      on: vi.fn((name: string, listener: (...args: unknown[]) => void) => {
        nativeListeners.set(name, listener);
      }),
      removeListener: vi.fn((name: string) => {
        nativeListeners.delete(name);
      }),
      setFeedURL: vi.fn(),
      checkForUpdates: vi.fn(),
      quitAndInstall: vi.fn(),
    },
  };
});
vi.mock("electron", () => ({
  app: {
    get isPackaged() {
      return mocks.packaged;
    },
    getVersion: () => "1.0.0",
    once: (name: string, listener: () => void) =>
      mocks.hooks.set(name, listener),
  },
  autoUpdater: mocks.native,
  BrowserWindow: {
    fromWebContents: (sender: unknown) =>
      sender === mocks.sender ? mocks.window : null,
    getAllWindows: () => [mocks.window],
  },
  dialog: { showMessageBox: mocks.dialog },
  shell: { openExternal: mocks.openExternal },
  ipcMain: {
    handle: (name: string, handler: (event: unknown) => unknown) =>
      mocks.handlers.set(name, handler),
  },
}));
vi.mock("node:fs", () => ({ existsSync: () => mocks.exists }));
vi.mock("@/main/rpc/sender", () => ({
  getRpcRendererUrl: () => "https://renderer.test/public/index.html",
  isRpcRendererUrl: (actual: string, expected: string) => actual === expected,
}));
vi.mock("@/lib/auth/service", () => ({ cancelAuth: mocks.cancelAuth }));
vi.mock("@/lib/game/service", () => ({ gameIsBusy: () => mocks.busy }));
import { registerUpdateIpc } from "@/main/services/updates";
const event = () => ({ sender: mocks.sender, senderFrame: mocks.frame });
async function invoke(name: string, value: unknown = event()) {
  return await mocks.handlers.get("update:" + name)!(value);
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.handlers.clear();
  mocks.hooks.clear();
  mocks.nativeListeners.clear();
  mocks.packaged = false;
  mocks.exists = true;
  mocks.busy = false;
  mocks.frame.url = "https://renderer.test/public/index.html";
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => {
  mocks.hooks.get("will-quit")?.();
  vi.unstubAllGlobals();
});
it("exposes installed version in dev without calling network/native updater", async () => {
  registerUpdateIpc();
  expect(await invoke("state")).toMatchObject({
    version: "1.0.0",
    status: "disabled",
  });
  await invoke("check");
  await invoke("download");
  await invoke("install");
  expect(mocks.fetch).not.toHaveBeenCalled();
  expect(mocks.native.checkForUpdates).not.toHaveBeenCalled();
  expect(mocks.native.quitAndInstall).not.toHaveBeenCalled();
});
it("rejects remote windows, missing frames, iframes and navigated renderers on every updater operation", async () => {
  registerUpdateIpc();
  const rejected = [
    { sender: {}, senderFrame: mocks.frame },
    { sender: mocks.sender },
    { sender: mocks.sender, senderFrame: { ...mocks.frame } },
  ];
  for (const name of ["state", "check", "download", "install", "releases"]) {
    for (const untrusted of rejected)
      await expect(invoke(name, untrusted)).rejects.toThrow("Untrusted");
    mocks.frame.url = "https://evil.test/";
    await expect(invoke(name)).rejects.toThrow("Untrusted");
    mocks.frame.url = "https://renderer.test/public/index.html";
  }
  expect(mocks.openExternal).not.toHaveBeenCalled();
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it("opens only the configured public Releases page", async () => {
  registerUpdateIpc();
  await invoke("releases");
  expect(mocks.openExternal).toHaveBeenCalledWith(
    "https://github.com/gorth-io/gorth-launcher/releases",
  );
});
it("disables native updates for Windows portable/uninstalled builds", async () => {
  vi.stubGlobal("process", {
    ...process,
    platform: "win32",
    argv: [],
    execPath: "C:/portable/Gorth.exe",
  });
  mocks.packaged = true;
  mocks.exists = false;
  registerUpdateIpc();
  expect(await invoke("check")).toMatchObject({ status: "disabled" });
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it("waits for the Squirrel first-run installation lock", async () => {
  vi.stubGlobal("process", {
    ...process,
    platform: "win32",
    argv: ["app", "--squirrel-firstrun"],
    execPath: "C:/App/Gorth.exe",
  });
  mocks.packaged = true;
  registerUpdateIpc();
  expect(await invoke("check")).toMatchObject({
    status: "idle",
    message: expect.stringContaining("10"),
  });
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it("uses the native download event, confirms restart and cancels pending authentication only after consent", async () => {
  vi.stubGlobal("process", {
    ...process,
    platform: "darwin",
    arch: "arm64",
    argv: [],
  });
  mocks.packaged = true;
  mocks.fetch.mockResolvedValue(
    new Response(
      JSON.stringify({
        tag_name: "v1.1.0",
        draft: false,
        prerelease: false,
        assets: [{ name: "gorth-darwin-arm64-1.1.0.zip" }],
      }),
    ),
  );
  registerUpdateIpc();
  await invoke("install");
  expect(mocks.dialog).not.toHaveBeenCalled();
  await invoke("check");
  await invoke("download");
  mocks.nativeListeners.get("update-downloaded")!({}, "", "1.1.0");
  mocks.busy = true;
  expect(await invoke("install")).toMatchObject({ status: "downloaded" });
  expect(mocks.dialog).not.toHaveBeenCalled();
  mocks.busy = false;
  mocks.dialog.mockResolvedValueOnce({ response: 1 });
  await invoke("install");
  expect(mocks.cancelAuth).not.toHaveBeenCalled();
  expect(mocks.native.quitAndInstall).not.toHaveBeenCalled();
  mocks.dialog.mockResolvedValueOnce({ response: 0 });
  await invoke("install");
  expect(mocks.cancelAuth).toHaveBeenCalledOnce();
  expect(mocks.native.quitAndInstall).toHaveBeenCalledOnce();
});
