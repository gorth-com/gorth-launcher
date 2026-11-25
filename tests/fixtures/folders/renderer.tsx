import { createRoot } from "react-dom/client";
import {
  QueryClient,
  QueryClientProvider,
} from "@gorth-com/primitive/cores/tanstack/query";
import { FoldersCard } from "@/components/element/folders-card";
import { ToasterProvider } from "@/providers/toaster";
import type { FolderSnapshot } from "@/utils/folder-interface";
import "@/styles/globals.css";
const calls: string[] = [];
let state: FolderSnapshot = {
  restartRequired: false,
  folders: [
    {
      id: "application",
      label: "Application",
      path: "/fixture/app",
      activePath: "/fixture/app",
      editable: false,
    },
    {
      id: "downloads",
      label: "Downloads",
      path: "/fixture/downloads",
      activePath: "/fixture/downloads",
      editable: true,
    },
  ],
};
Object.assign(window, {
  folderCalls: calls,
  electronAPI: {
    folders: {
      list: async () => state,
      choose: async (id: string) => {
        calls.push("choose:" + id);
        state = {
          restartRequired: true,
          folders: state.folders.map((folder) =>
            folder.id === id
              ? { ...folder, path: "/fixture/selected" }
              : folder,
          ),
        };
        return state;
      },
      open: async (id: string) => {
        calls.push("open:" + id);
      },
    },
  },
});
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient()}>
    <ToasterProvider>
      <FoldersCard />
    </ToasterProvider>
  </QueryClientProvider>,
);
