import { ipcRenderer } from "electron";
import type { UpdateState } from "@/lib/update/interface";
export const updateApi = {
  state: (): Promise<UpdateState> => ipcRenderer.invoke("update:state"),
  check: (): Promise<UpdateState> => ipcRenderer.invoke("update:check"),
  download: (): Promise<UpdateState> => ipcRenderer.invoke("update:download"),
  install: (): Promise<UpdateState> => ipcRenderer.invoke("update:install"),
  openReleases: (): Promise<void> => ipcRenderer.invoke("update:releases"),
  onChanged(callback: (state: UpdateState) => void) {
    const listener = (_event: Electron.IpcRendererEvent, state: UpdateState) =>
      callback(state);
    ipcRenderer.on("update:changed", listener);
    return () => {
      ipcRenderer.removeListener("update:changed", listener);
    };
  },
};
