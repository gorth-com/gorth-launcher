import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import path from "node:path";
const backend = spawnSync(
  process.execPath,
  [
    "node_modules/vitest/vitest.mjs",
    "run",
    "tests/desktop-server.test.ts",
    "--configLoader",
    "runner",
  ],
  { stdio: "inherit" },
);
if (backend.status !== 0) process.exit(backend.status ?? 1);
await build({
  entryPoints: ["tests/auth-profile.test.ts"],
  external: ["axios"],
  define: {
    MAIN_WINDOW_VITE_DEV_SERVER_URL: '"http://localhost:5502"',
    MAIN_WINDOW_VITE_NAME: '"main_window"',
    "import.meta.env": "undefined",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: ".vite/auth-profile-test.mjs",
  alias: { electron: path.resolve("tests/electron-auth-mock.ts") },
  plugins: [
    {
      name: "verified-provider-fixture",
      setup(build) {
        build.onResolve(
          { filter: /^(?:\.\/gorth|@\/lib\/auth\/gorth)$/ },
          () => ({
            path: path.resolve("tests/auth-profile-provider-mock.ts"),
          }),
        );
      },
    },
  ],
});
const result = spawnSync(
  process.execPath,
  ["--test", ".vite/auth-profile-test.mjs"],
  { stdio: "inherit" },
);
process.exitCode = result.status ?? 1;
