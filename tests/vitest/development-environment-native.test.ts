import { execFile } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { build } from "esbuild";
import { expect, it, vi } from "vitest";
import { loadDevelopmentEnvironment } from "@/utils/development-environment";

it("inherits private local env in a real isolated Electron main before module evaluation", async () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const require = createRequire(import.meta.url);
  const electronRoot = path.dirname(require.resolve("electron/package.json"));
  const electron = path.join(
    electronRoot,
    "dist",
    (await readFile(path.join(electronRoot, "path.txt"), "utf8")).trim(),
  );
  const directory = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "gorth-env-native-")),
  );
  vi.stubEnv("GORTH_TEST_PRIVATE", undefined);
  vi.stubEnv("VITE_PUBLIC_AUTH_URL", undefined);
  try {
    await mkdir(path.join(directory, "profile"));
    await writeFile(
      path.join(directory, ".env.local"),
      "GORTH_TEST_PRIVATE='$fixture$main-only'\nVITE_PUBLIC_AUTH_URL=https://fixture.invalid\n",
    );
    loadDevelopmentEnvironment(directory);
    const entry = path.join(directory, "main.cjs");
    await build({
      absWorkingDir: root,
      entryPoints: ["tests/fixtures/development-environment/main.ts"],
      bundle: true,
      platform: "node",
      format: "cjs",
      external: ["electron"],
      outfile: entry,
      define: {
        "import.meta.env": "{}",
        MAIN_WINDOW_VITE_DEV_SERVER_URL: '""',
      },
    });
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.NODE_OPTIONS;
    const { stdout } = await promisify(execFile)(electron, [entry, directory], {
      cwd: directory,
      env,
      timeout: 15_000,
      maxBuffer: 256_000,
    });
    const line = stdout
      .split(/\r?\n/)
      .find((item) => item.startsWith("GORTH_ENV_MAIN="));
    expect(line).toBeDefined();
    expect(JSON.parse(line!.slice("GORTH_ENV_MAIN=".length))).toEqual({
      privateAvailable: true,
      publicAvailable: true,
    });
  } finally {
    vi.unstubAllEnvs();
    await rm(directory, { recursive: true, force: true });
  }
});
