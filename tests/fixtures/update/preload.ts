import { contextBridge } from "electron";
import { updateApi } from "@/preload/api/updates";
contextBridge.exposeInMainWorld("electronAPI", { updates: updateApi });
