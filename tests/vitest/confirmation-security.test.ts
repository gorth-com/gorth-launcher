import { EventEmitter } from "node:events";
import { afterEach, expect, it, vi } from "vitest";
import type { BrowserWindow } from "electron";
const { ipc } = vi.hoisted(() => ({
  ipc: new Map<string, Set<(...args: unknown[]) => void>>(),
}));
vi.mock("electron", () => ({
  ipcMain: {
    on: (channel: string, callback: (...args: unknown[]) => void) => {
      const set = ipc.get(channel) ?? new Set();
      set.add(callback);
      ipc.set(channel, set);
    },
    removeListener: (channel: string, callback: (...args: unknown[]) => void) =>
      ipc.get(channel)?.delete(callback),
  },
}));
import { requestConfirmation } from "@/main/services/confirmation";
import { confirmationChannels } from "@/lib/confirmation";
afterEach(() => {
  ipc.clear();
  vi.useRealTimers();
});
function fixture() {
  const contents = Object.assign(new EventEmitter(), {
    isDestroyed: () => false,
    mainFrame: {},
    send: vi.fn(),
  });
  const owner = Object.assign(new EventEmitter(), {
    isDestroyed: () => false,
    webContents: contents,
  });
  const sendAnswer = (event: unknown, id: unknown, answer: unknown) =>
    ipc
      .get(confirmationChannels.answer)
      ?.forEach((listener) => listener(event, id, answer));
  return { owner: owner as unknown as BrowserWindow, contents, sendAnswer };
}
it("accepts only the matching request from the owning chrome main frame", async () => {
  const { owner, contents, sendAnswer } = fixture();
  const pending = requestConfirmation(owner, { title: "Delete?" });
  const id = contents.send.mock.calls[0][1].id;
  sendAnswer({ sender: {}, senderFrame: contents.mainFrame }, id, true);
  sendAnswer({ sender: contents, senderFrame: {} }, id, true);
  sendAnswer(
    { sender: contents, senderFrame: contents.mainFrame },
    "wrong",
    true,
  );
  expect(ipc.get(confirmationChannels.answer)?.size).toBe(1);
  sendAnswer({ sender: contents, senderFrame: contents.mainFrame }, id, true);
  expect(await pending).toBe(true);
  expect(ipc.get(confirmationChannels.answer)?.size).toBe(0);
});
it("denies on navigation and timeout, removing reply listeners", async () => {
  const first = fixture();
  const pending = requestConfirmation(first.owner, { title: "Delete?" });
  first.contents.emit("did-start-navigation");
  expect(await pending).toBe(false);
  vi.useFakeTimers();
  const second = fixture();
  const timed = requestConfirmation(second.owner, { title: "Delete?" });
  await vi.advanceTimersByTimeAsync(120_000);
  expect(await timed).toBe(false);
  expect(ipc.get(confirmationChannels.answer)?.size).toBe(0);
});
