import path from "node:path";
import { glob } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { buildDesktopBackend } from "./lib/server/build.ts";

export default defineConfig({
  plugins: [
    {
      name: "desktop-nitro-backend",
      async buildStart() {
        const root = path.dirname(fileURLToPath(import.meta.url));
        for await (const source of glob(
          [
            "routes/**/*.ts",
            "controllers/**/*.ts",
            "middlewares/**/*.ts",
            "lib/server/**/*.ts",
            "nitro.config.ts",
          ],
          { cwd: root },
        )) {
          this.addWatchFile(path.join(root, source));
        }
        await buildDesktopBackend(root);
      },
    },
  ],
  build: {
    rollupOptions: {
      external: ["better-sqlite3"],
    },
  },
  resolve: {
    alias: {
      "@": path.dirname(fileURLToPath(import.meta.url)),
    },
  },
});
