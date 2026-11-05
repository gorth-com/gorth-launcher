import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { createDesktopDevServer } from "./lib/server/vite.ts";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root,
  // index.html is a renderer entry and must be transformed, not copied verbatim.
  publicDir: false,
  cacheDir: ".vite/cache",
  build: {
    rolldownOptions: { input: path.resolve(root, "public/index.html") },
  },
  server: createDesktopDevServer(root, 5502),
  resolve: {
    // Forge enables this by default; Deno's isolated dependencies need real paths.
    preserveSymlinks: false,
    dedupe: ["react", "react-dom"],
    alias: {
      "@": root,
    },
  },
});
