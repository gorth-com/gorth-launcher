import { EventEmitter } from "node:events";
import { expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({ prepare: vi.fn(async () => {}) }));
vi.mock("@/main/services/proxy", () => ({
  prepareNetworkPartition: fixture.prepare,
}));

vi.mock("electron", async () => {
  const { EventEmitter } = await import("node:events");
  return {
    nativeTheme: Object.assign(new EventEmitter(), {
      shouldUseDarkColors: true,
    }),
    session: {
      fromPartition: () =>
        Object.assign(new EventEmitter(), {
          setPermissionRequestHandler: vi.fn(),
          setPermissionCheckHandler: vi.fn(),
        }),
    },
  };
});
import { nativeTheme, session } from "electron";
import {
  installWebview,
  prepareContentWebsiteSession,
} from "@/main/windows/webview";

it("creates the preview session only on demand and waits for proxy preparation", async () => {
  const getSession = vi.spyOn(session, "fromPartition");
  const owner = Object.assign(new EventEmitter(), {
    webContents: new EventEmitter(),
  });
  installWebview(owner as never);
  expect(getSession).not.toHaveBeenCalled();
  const event = { preventDefault: vi.fn() };
  const params = {
    src: "https://www.curseforge.com/minecraft/modpacks/fixture",
    partition: "content-websites",
  };
  owner.webContents.emit("will-attach-webview", event, {}, params);
  expect(event.preventDefault).toHaveBeenCalledOnce();
  let release!: () => void;
  fixture.prepare.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  const first = prepareContentWebsiteSession();
  const second = prepareContentWebsiteSession();
  expect(getSession).not.toHaveBeenCalled();
  release();
  await Promise.all([first, second]);
  expect(fixture.prepare).toHaveBeenCalledExactlyOnceWith("content-websites");
  expect(getSession).toHaveBeenCalledExactlyOnceWith("content-websites");
  event.preventDefault.mockClear();
  const preferences: Record<string, unknown> = {};
  owner.webContents.emit("will-attach-webview", event, preferences, params);
  expect(event.preventDefault).not.toHaveBeenCalled();
  expect(preferences).toMatchObject({
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false,
  });
});

it("updates only allowed project webviews on document load and theme changes, then removes its listener", async () => {
  const owner = Object.assign(new EventEmitter(), {
    webContents: new EventEmitter(),
  });
  let url = "https://www.curseforge.com/minecraft/modpacks/fixture";
  const executeJavaScript = vi.fn().mockResolvedValue(undefined);
  const contents = Object.assign(new EventEmitter(), {
    isDestroyed: () => false,
    getURL: () => url,
    executeJavaScript,
    setWindowOpenHandler: vi.fn(),
  });
  installWebview(owner as never);
  owner.webContents.emit("did-attach-webview", {}, contents);
  contents.emit("dom-ready");
  expect(executeJavaScript.mock.calls[0][0]).toContain('const theme = "dark"');
  Object.assign(nativeTheme, { shouldUseDarkColors: false });
  nativeTheme.emit("updated");
  expect(executeJavaScript.mock.calls[1][0]).toContain('const theme = "light"');
  url = "https://untrusted.example/";
  nativeTheme.emit("updated");
  expect(executeJavaScript).toHaveBeenCalledTimes(2);
  contents.emit("destroyed");
  expect(nativeTheme.listenerCount("updated")).toBe(0);
  await Promise.resolve();
});
