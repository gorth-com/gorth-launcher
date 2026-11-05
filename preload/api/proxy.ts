import { ipcRenderer } from "electron";
import type { ProxyUpdate, ProxyView } from "@/lib/network/proxy";
export const networkProxyApi = {
  get: (): Promise<ProxyView> => ipcRenderer.invoke("network-proxy:get"),
  save: (input: ProxyUpdate): Promise<ProxyView> =>
    ipcRenderer.invoke("network-proxy:save", input),
  route: (): Promise<string> => ipcRenderer.invoke("network-proxy:route"),
};
