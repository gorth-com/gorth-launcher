import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { createNitro, prepare, build as buildNitro } from "nitro/builder";
const nitro = await createNitro({ rootDir: process.cwd() }, { dotenv: false });
try {
  await prepare(nitro);
  await buildNitro(nitro);
} finally {
  await nitro.close();
}
import { getElectronExecutable } from "../tests/helpers/electron.ts";
const electron = getElectronExecutable();
const probe = createServer((_req, res) => res.end("probe"));
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
await build({
  entryPoints: ["tests/desktop-server-native.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron", "vite"],
  outfile: ".vite/server-native.cjs",
  define: { "import.meta.env": "undefined" },
});
await build({
  entryPoints: ["tests/desktop-server-native-preload.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron"],
  outfile: ".vite/server-native-preload.cjs",
});
const nativeEnvironment = { ...process.env };
delete nativeEnvironment.ELECTRON_RUN_AS_NODE;
const result = spawnSync(electron, [".vite/server-native.cjs"], {
  stdio: ["ignore", "pipe", "pipe"],
  encoding: "utf8",
  timeout: 60_000,
  env: {
    ...nativeEnvironment,
    VITE_PUBLIC_APP_URL: `http://localhost:${port}`,
  },
});
process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");
process.exitCode =
  result.status === 0 &&
  result.stdout?.includes("callback replay protection passed.")
    ? 0
    : 1;
