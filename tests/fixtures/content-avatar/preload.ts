import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("avatarTest", {
  search: () => ipcRenderer.invoke("avatar-test:search"),
});
