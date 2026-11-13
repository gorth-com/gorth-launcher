import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { build } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { expect, it } from "vitest";

it("edits five-tab overrides, uses the shared Java dialog and resets state when switching instance in Electron", async () => {
  if (process.platform === "darwin" && process.env.CODEX_SANDBOX === "seatbelt")
    throw new Error(
      "Electron settings verification needs GUI permission outside the sandbox",
    );
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const require = createRequire(import.meta.url);
  const electronRoot = path.dirname(require.resolve("electron/package.json"));
  const executable = path.join(
    electronRoot,
    "dist",
    (await readFile(path.join(electronRoot, "path.txt"), "utf8")).trim(),
  );
  const directory = await realpath(
    await mkdtemp(path.join(tmpdir(), "gorth-instance-settings-")),
  );
  try {
    await mkdir(path.join(directory, "profile"));
    await build({
      configFile: false,
      envDir: false,
      base: "./",
      logLevel: "error",
      root: path.join(root, "tests/fixtures/instance-settings"),
      cacheDir: path.join(directory, "cache"),
      plugins: [react(), tailwind()],
      resolve: { alias: { "@": root }, dedupe: ["react", "react-dom"] },
      build: { outDir: path.join(directory, "renderer"), emptyOutDir: false },
    });
    await build({
      configFile: false,
      envDir: false,
      logLevel: "error",
      build: {
        ssr: true,
        lib: {
          entry: path.join(root, "tests/fixtures/instance-settings/main.ts"),
          formats: ["cjs"],
          fileName: () => "main.cjs",
        },
        outDir: directory,
        emptyOutDir: false,
        rolldownOptions: { external: ["electron"] },
      },
    });
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.NODE_OPTIONS;
    const { stdout } = await promisify(execFile)(
      executable,
      [path.join(directory, "main.cjs"), directory],
      { cwd: root, env, timeout: 30000, maxBuffer: 512000 },
    );
    const line = stdout
      .split(/\r?\n/)
      .find((value) => value.startsWith("GORTH_INSTANCE_SETTINGS="));
    expect(line, stdout).toBeDefined();
    const result = JSON.parse(line!.slice("GORTH_INSTANCE_SETTINGS=".length));
    expect(result.errors).toEqual([]);
    expect(result.passed).toBe(true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
