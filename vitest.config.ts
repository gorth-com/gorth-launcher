import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Test fixtures must not inherit credentials or the renderer dev server.
  envDir: false,
  cacheDir: ".vite/tests",
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    environment: "node",
    cache: false,
    fsModuleCachePath: ".vite/tests/fs",
    server: { deps: { inline: ["@better-auth/electron"] } },
    globals: false,
    // Legacy node:test/native scripts remain separate until explicitly migrated.
    include: [
      "tests/vitest/**/*.test.{ts,tsx}",
      "tests/{auth,auth-service,auth-view,http,rpc,desktop-server}.test.ts",
      "tests/game.test.ts",
    ],
    fileParallelism: false,
    testTimeout: 45_000,
    hookTimeout: 15_000,
    restoreMocks: true,
  },
});
