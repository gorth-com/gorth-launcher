import { ipcRenderer } from "electron";
import type { FolderSnapshot } from "@/utils/folder-interface";
export const foldersApi = {
  list: (): Promise<FolderSnapshot> => ipcRenderer.invoke("folders:list"),
  choose: (id: string): Promise<FolderSnapshot | null> =>
    ipcRenderer.invoke("folders:choose", id),
  open: (id: string): Promise<void> => ipcRenderer.invoke("folders:open", id),
};
