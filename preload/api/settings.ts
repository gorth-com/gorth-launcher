import { ipcRenderer } from "electron";
import type {
  JavaInstallation,
  JavaPreferences,
} from "@/lib/library/game-preferences";
export const settingsApi = {
  setTheme: (theme: "light" | "dark" | "system"): Promise<void> =>
    ipcRenderer.invoke("settings:theme", theme),
  javaInstallations: (): Promise<JavaInstallation[]> =>
    ipcRenderer.invoke("settings:java-installations"),
  chooseJava: (): Promise<string | null> =>
    ipcRenderer.invoke("settings:choose-java"),
  testJava: (input: {
    path: string;
    major: number;
    preferences: JavaPreferences;
  }): Promise<JavaInstallation> =>
    ipcRenderer.invoke("settings:test-java", input),
  openFolder: (
    folder: "data" | "instances" | "java" | "downloads",
  ): Promise<void> => ipcRenderer.invoke("settings:open-folder", folder),
  chooseTool: (): Promise<string | null> =>
    ipcRenderer.invoke("settings:choose-tool"),
  checkTool: (file: string): Promise<boolean> =>
    ipcRenderer.invoke("settings:check-tool", file),
};
