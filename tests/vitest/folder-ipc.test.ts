import { mkdtemp, mkdir, realpath, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import type { FolderSnapshot } from "@/utils/folder-interface";
const fixture = vi.hoisted(() => ({
  data: "",
  downloads: "",
  selected: "",
  canceled: false,
  confirm: true,
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  frame: { url: "https://fixture.invalid/public/index.html" },
  open: vi.fn(async () => ""),
}));
const sender = vi.hoisted(() => ({ mainFrame: fixture.frame }));
vi.mock("electron", () => ({
  app: {
    isPackaged: false,
    getAppPath: () => fixture.data,
    getPath: (key: string) =>
      key === "downloads" ? fixture.downloads : fixture.data,
  },
  BrowserWindow: {
    fromWebContents: (value: unknown) =>
      value === sender ? { webContents: sender } : null,
  },
  ipcMain: {
    handle: (key: string, handler: (...args: unknown[]) => unknown) =>
      fixture.handlers.set(key, handler),
  },
  shell: { openPath: fixture.open },
  dialog: {
    showOpenDialog: async () => ({
      canceled: fixture.canceled,
      filePaths: [fixture.selected],
    }),
  },
}));
vi.mock("@/main/rpc/sender", () => ({
  getRpcRendererUrl: () => fixture.frame.url,
  isRpcRendererUrl: (actual: string, expected: string) => actual === expected,
}));
vi.mock("@/main/services/confirmation", () => ({
  requestConfirmation: async () => fixture.confirm,
}));
import {
  registerFolderIpc,
  launcherFolderSnapshot,
} from "@/main/services/folders";
import {
  readFolderPreferences,
  getLauncherFolders,
} from "@/utils/launcher-folders";
const event = { sender, senderFrame: fixture.frame };
beforeEach(async () => {
  fixture.data = await mkdtemp(path.join(os.tmpdir(), "gorth-folder-ipc-"));
  fixture.downloads = path.join(fixture.data, "Downloads");
  fixture.selected = path.join(fixture.data, "Chosen");
  await mkdir(fixture.selected);
  fixture.handlers.clear();
  fixture.open.mockClear();
  fixture.canceled = false;
  fixture.confirm = true;
  registerFolderIpc();
});
afterEach(async () => {
  await rm(fixture.data, { recursive: true, force: true });
});
it("lists read-only app/profile paths, all requested locations and pending restart state", () => {
  const snapshot = launcherFolderSnapshot();
  expect(snapshot.restartRequired).toBe(false);
  expect(
    snapshot.folders.filter((item) => !item.editable).map((item) => item.id),
  ).toEqual(["application", "data"]);
  expect(snapshot.folders.map((item) => item.id)).toEqual(
    expect.arrayContaining([
      "root",
      "instances",
      "mods",
      "skins",
      "java",
      "iconThemes",
      "widgetThemes",
      "catPacks",
      "instanceIcons",
      "downloads",
      "logs",
    ]),
  );
});
it("persists only a natively chosen directory and keeps active game paths unchanged", async () => {
  const old = getLauncherFolders(fixture.data).instances;
  const snapshot = (await fixture.handlers.get("folders:choose")!(
    event,
    "instances",
  )) as FolderSnapshot;
  expect(snapshot.restartRequired).toBe(true);
  expect(readFolderPreferences(fixture.data).instances).toBe(
    await realpath(fixture.selected),
  );
  expect(getLauncherFolders(fixture.data).instances).toBe(old);
});
it("does not save after native cancellation or rejected confirmation", async () => {
  fixture.canceled = true;
  expect(
    await fixture.handlers.get("folders:choose")!(event, "java"),
  ).toBeNull();
  fixture.canceled = false;
  fixture.confirm = false;
  expect(
    await fixture.handlers.get("folders:choose")!(event, "java"),
  ).toBeNull();
  expect(readFolderPreferences(fixture.data)).toEqual({});
});
it("rejects remote senders, subframes, arbitrary paths and readonly keys", async () => {
  expect(() =>
    fixture.handlers.get("folders:list")!({
      sender: {},
      senderFrame: fixture.frame,
    }),
  ).toThrow("Untrusted");
  expect(() =>
    fixture.handlers.get("folders:list")!({
      sender,
      senderFrame: { ...fixture.frame },
    }),
  ).toThrow("Untrusted");
  await expect(
    fixture.handlers.get("folders:choose")!(event, "application"),
  ).rejects.toThrow();
  expect(() => fixture.handlers.get("folders:open")!(event, {})).toThrow();
  await expect(
    fixture.handlers.get("folders:open")!(event, "/arbitrary/file"),
  ).rejects.toThrow();
  expect(fixture.open).not.toHaveBeenCalled();
});
it("opens only a resolved known folder using the OS shell", async () => {
  await fixture.handlers.get("folders:open")!(event, "downloads");
  expect(fixture.open).toHaveBeenCalledWith(fixture.downloads);
});
