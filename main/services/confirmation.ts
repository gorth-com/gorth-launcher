import { ipcMain, type BrowserWindow, type IpcMainEvent } from "electron";
import { randomUUID } from "node:crypto";
import {
  confirmationChannels,
  type ConfirmationOptions,
} from "@/lib/confirmation";
// Only the requesting chrome renderer's main frame may answer. Reload/close/timeout deny.
export function requestConfirmation(
  owner: BrowserWindow,
  options: ConfirmationOptions,
): Promise<boolean> {
  if (owner.isDestroyed() || owner.webContents.isDestroyed())
    return Promise.resolve(false);
  const contents = owner.webContents;
  const id = randomUUID();
  return new Promise((resolve) => {
    let settled = false;
    const finish = (answer: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      ipcMain.removeListener(confirmationChannels.answer, onAnswer);
      contents.removeListener("destroyed", cancel);
      contents.removeListener("did-start-navigation", cancel);
      owner.removeListener("closed", cancel);
      if (!contents.isDestroyed())
        contents.send(confirmationChannels.cancel, id);
      resolve(answer);
    };
    const cancel = () => finish(false);
    const onAnswer = (
      event: IpcMainEvent,
      requestId: unknown,
      answer: unknown,
    ) => {
      if (
        event.sender !== contents ||
        event.senderFrame !== contents.mainFrame ||
        requestId !== id ||
        typeof answer !== "boolean"
      )
        return;
      finish(answer);
    };
    const timer = setTimeout(cancel, 120_000);
    ipcMain.on(confirmationChannels.answer, onAnswer);
    contents.once("destroyed", cancel);
    contents.once("did-start-navigation", cancel);
    owner.once("closed", cancel);
    contents.send(confirmationChannels.request, { ...options, id });
  });
}
