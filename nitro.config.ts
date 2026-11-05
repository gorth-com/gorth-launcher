import { defineConfig } from "nitro";

export default defineConfig({
  preset: "node-middleware",
  entry: "./lib/server/entry.ts",
  serverDir: ".",
  buildDir: ".nitro",
  output: { dir: ".vite/server", serverDir: ".vite/server" },
  handlers: [
    { route: "/**", handler: "./middlewares/http.ts", middleware: true },
  ],
  alias: { "@": import.meta.dirname },
  noPublicDir: true,
  publicAssets: [],
  serveStatic: false,
  errorHandler: "./lib/server/error.ts",
});
