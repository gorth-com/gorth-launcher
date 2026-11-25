import { ipcRenderer } from "electron";
import type {
  ContentInstall,
  ContentInventory,
  ContentManage,
  ContentProject,
  ContentQuery,
  ContentResult,
  ContentStatus,
  ContentVersion,
  ModpackOverview,
} from "@/lib/content/interface";
export const contentApi = {
  preparePreview: (): Promise<ContentResult<null>> =>
    ipcRenderer.invoke("content:prepare-preview"),
  packOverview: (
    instanceId: string,
  ): Promise<ContentResult<ModpackOverview | null>> =>
    ipcRenderer.invoke("content:pack-overview", { instanceId }),
  packChangelog: (
    instanceId: string,
    versionId: string,
  ): Promise<ContentResult<{ text: string; format: "html" | "text" }>> =>
    ipcRenderer.invoke("content:pack-changelog", { instanceId, versionId }),
  packWebsite: (instanceId: string): Promise<ContentResult<null>> =>
    ipcRenderer.invoke("content:pack-website", { instanceId }),
  updatePack: (
    instanceId: string,
    versionId: string,
    fromFile = false,
  ): Promise<ContentResult<{ cancelled: boolean }>> =>
    ipcRenderer.invoke("content:pack-update", {
      instanceId,
      versionId,
      fromFile,
    }),
  status: (): Promise<{
    status: ContentStatus;
    curseforgeConfigured: boolean;
  }> => ipcRenderer.invoke("content:status"),
  search: (
    query: ContentQuery,
  ): Promise<ContentResult<{ projects: ContentProject[]; more: boolean }>> =>
    ipcRenderer.invoke("content:search", query),
  versions: (
    query: ContentQuery,
    projectId: string,
  ): Promise<ContentResult<ContentVersion[]>> =>
    ipcRenderer.invoke("content:versions", { query, projectId }),
  install: (input: ContentInstall): Promise<ContentResult<null>> =>
    ipcRenderer.invoke("content:install", input),
  inventory: (instanceId: string): Promise<ContentResult<ContentInventory>> =>
    ipcRenderer.invoke("content:inventory", { instanceId }),
  metadata: (instanceId: string): Promise<ContentResult<ContentInventory>> =>
    ipcRenderer.invoke("content:metadata", { instanceId }),
  updates: (instanceId: string): Promise<ContentResult<ContentInventory>> =>
    ipcRenderer.invoke("content:updates", { instanceId }),
  manage: (input: ContentManage): Promise<ContentResult<ContentInventory>> =>
    ipcRenderer.invoke("content:manage", input),
  importPack: (): Promise<ContentResult<null>> =>
    ipcRenderer.invoke("content:import"),
  cancel: (): Promise<void> => ipcRenderer.invoke("content:cancel"),
  selectOptional: (
    requestId: string,
    ids: string[],
  ): Promise<ContentResult<null>> =>
    ipcRenderer.invoke("content:select-optional", { requestId, ids }),
  onChanged: (callback: (status: ContentStatus) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      status: ContentStatus,
    ) => callback(status);
    ipcRenderer.on("content:changed", listener);
    return () => ipcRenderer.removeListener("content:changed", listener);
  },
};
