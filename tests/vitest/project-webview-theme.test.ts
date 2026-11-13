import { EventEmitter } from "node:events";
import { expect, it, vi } from "vitest";

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
import { nativeTheme } from "electron";
import { installWebview } from "@/main/windows/webview";

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
