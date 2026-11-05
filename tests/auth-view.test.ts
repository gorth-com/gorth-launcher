import { EventEmitter } from "node:events";
import { expect, it, vi } from "vitest";
import { handlers } from "./electron-auth-mock";
import {
  openAuthView,
  closeAuthView,
  registerAuthViewIpc,
} from "@/main/services/auth-view";
vi.mock("electron", () => import("./electron-auth-mock"));

it("shows only a public waiting state, validates IPC and cancels when the owner closes", () => {
  const sent: unknown[] = [];
  const owner = Object.assign(new EventEmitter(), {
    isDestroyed: () => false,
    webContents: {
      isDestroyed: () => false,
      send: (_channel: string, value: unknown) => sent.push(value),
    },
  });
  const event = { owner } as unknown as Electron.IpcMainInvokeEvent;
  registerAuthViewIpc((incoming) => {
    if (incoming !== event) throw new Error("Untrusted auth sender");
    return owner as unknown as Electron.BrowserWindow;
  });
  const controller = new AbortController();
  openAuthView(owner as unknown as Electron.BrowserWindow, controller, "login");
  expect(handlers.get("auth:view-state")!(event)).toMatchObject({
    visible: true,
    loading: false,
  });
  expect(handlers.get("auth:view-tab")!(event, "../bad")).toBe(false);
  expect(handlers.get("auth:view-tab")!(event, "tab-one")).toBe(true);
  expect(() => handlers.get("auth:view-state")!({})).toThrow("Untrusted");
  expect(JSON.stringify(sent)).not.toMatch(/code|token|verifier|cookie/);
  owner.emit("closed");
  expect(controller.signal.aborted).toBe(true);
  expect(handlers.get("auth:view-state")!(event)).toMatchObject({
    visible: false,
    completed: false,
  });
  openAuthView(
    owner as unknown as Electron.BrowserWindow,
    new AbortController(),
    "register",
  );
  closeAuthView(owner as unknown as Electron.BrowserWindow, true);
  expect(handlers.get("auth:view-state")!(event)).toMatchObject({
    visible: false,
    completed: true,
  });
});
