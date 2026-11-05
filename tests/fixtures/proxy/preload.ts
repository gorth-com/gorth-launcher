import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("proxyFixture", {
  get: () => ipcRenderer.invoke("network-proxy:get"),
});
