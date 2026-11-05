import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, realpath, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { build as bundle } from "esbuild";
import { build } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { expect, it } from "vitest";
it("renders folder inputs, chooses only editable paths and opens the selected folder in real Electron", async () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const require = createRequire(import.meta.url);
  const electronRoot = path.dirname(require.resolve("electron/package.json"));
  const executable = path.join(
    electronRoot,
    "dist",
    (await readFile(path.join(electronRoot, "path.txt"), "utf8")).trim(),
  );
  const directory = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "gorth-folders-native-")),
  );
  try {
    await mkdir(path.join(directory, "profile"));
    await build({
      configFile: false,
      envDir: false,
      base: "./",
      logLevel: "error",
      root: path.join(root, "tests/fixtures/folders"),
      cacheDir: path.join(directory, "cache"),
      plugins: [react(), tailwind()],
      resolve: { alias: { "@": root } },
      build: { outDir: path.join(directory, "renderer"), emptyOutDir: false },
    });
    await bundle({
      absWorkingDir: root,
      entryPoints: ["tests/fixtures/folders/main.ts"],
      bundle: true,
      platform: "node",
      format: "cjs",
      external: ["electron"],
      outfile: path.join(directory, "main.cjs"),
    });
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.NODE_OPTIONS;
    const { stdout } = await promisify(execFile)(
      executable,
      [path.join(directory, "main.cjs"), directory],
      { cwd: root, env, timeout: 15000, maxBuffer: 512000 },
    );
    const line = stdout
      .split(/\r?\n/)
      .find((item) => item.startsWith("GORTH_FOLDERS="));
    expect(line).toBeDefined();
    const value = JSON.parse(line!.slice("GORTH_FOLDERS=".length));
    expect(value.errors).toEqual([]);
    expect(value.result).toEqual({
      calls: ["choose:downloads", "open:downloads"],
      readOnly: true,
      updated: "/fixture/selected",
      restart: true,
      primitiveInput: "input",
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
