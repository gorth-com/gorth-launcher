import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { build as bundle } from "esbuild";
import { build } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { expect, it } from "vitest";

it("shows errors only in the native toast portal and keeps startup retry available", async () => {
  if (process.platform === "darwin" && process.env.CODEX_SANDBOX === "seatbelt")
    throw new Error(
      "Native UI verification requires GUI permission outside the sandbox.",
    );
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const require = createRequire(import.meta.url);
  const electron = path.dirname(require.resolve("electron/package.json"));
  const executable = path.join(
    electron,
    "dist",
    (await readFile(path.join(electron, "path.txt"), "utf8")).trim(),
  );
  const directory = await mkdtemp(path.join(tmpdir(), "gorth-error-toast-"));
  try {
    await mkdir(path.join(directory, "profile"));
    await build({
      configFile: false,
      envDir: false,
      base: "./",
      logLevel: "error",
      root: path.join(root, "tests/fixtures/error-toast"),
      cacheDir: path.join(directory, "cache"),
      plugins: [react(), tailwind()],
      resolve: { alias: { "@": root } },
      build: { outDir: path.join(directory, "renderer"), emptyOutDir: false },
    });
    await bundle({
      absWorkingDir: root,
      entryPoints: ["tests/fixtures/error-toast/main.ts"],
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
      { cwd: root, env, timeout: 22000, maxBuffer: 512000 },
    );
    const line = stdout
      .split(/\r?\n/)
      .find((line) => line.startsWith("GORTH_ERROR_TOAST="));
    expect(line, stdout).toBeDefined();
    const { errors, result } = JSON.parse(
      line!.slice("GORTH_ERROR_TOAST=".length),
    );
    expect(errors).toEqual([]);
    expect(result).toEqual({
      portal: true,
      inline: false,
      toastCount: 1,
      startupPortal: true,
      startupInline: false,
      retry: true,
    });
  } finally {
    await rm(directory, { recursive: true, force: true, maxRetries: 3 });
  }
}, 60000);
