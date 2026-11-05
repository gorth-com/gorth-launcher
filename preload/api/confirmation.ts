import { ipcRenderer, type IpcRendererEvent } from "electron";
import {
  confirmationChannels,
  type ConfirmationRequest,
} from "@/lib/confirmation";
export const confirmationApi = {
  onRequest: (callback: (request: ConfirmationRequest) => void) => {
    const listener = (_event: IpcRendererEvent, request: ConfirmationRequest) =>
      callback(request);
    ipcRenderer.on(confirmationChannels.request, listener);
    return () => {
      ipcRenderer.removeListener(confirmationChannels.request, listener);
    };
  },
  onCancel: (callback: (id: string) => void) => {
    const listener = (_event: IpcRendererEvent, id: string) => callback(id);
    ipcRenderer.on(confirmationChannels.cancel, listener);
    return () => {
      ipcRenderer.removeListener(confirmationChannels.cancel, listener);
    };
  },
  answer: (id: string, answer: boolean) =>
    ipcRenderer.send(confirmationChannels.answer, id, answer),
};
