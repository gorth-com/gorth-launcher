import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { build as bundle } from "esbuild";
import { build } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { expect, it } from "vitest";
it("renders About update controls through the sandboxed preload and retains newer pushed state", async () => {
  if (process.platform === "darwin" && process.env.CODEX_SANDBOX === "seatbelt")
    throw new Error(
      "Electron UI tests need GUI permission outside the sandbox",
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
    await mkdtemp(path.join(tmpdir(), "gorth-update-ui-")),
  );
  try {
    await mkdir(path.join(directory, "profile"));
    await build({
      configFile: false,
      envDir: false,
      base: "./",
      logLevel: "error",
      root: path.join(root, "tests/fixtures/update"),
      cacheDir: path.join(directory, "vite-cache"),
      plugins: [react(), tailwind()],
      resolve: { alias: { "@": root } },
      build: { outDir: path.join(directory, "renderer"), emptyOutDir: false },
    });
    for (const entry of ["main", "preload"])
      await bundle({
        absWorkingDir: root,
        entryPoints: ["tests/fixtures/update/" + entry + ".ts"],
        bundle: true,
        platform: "node",
        format: "cjs",
        external: ["electron"],
        outfile: path.join(directory, entry + ".cjs"),
      });
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.NODE_OPTIONS;
    const { stdout } = await promisify(execFile)(
      executable,
      [path.join(directory, "main.cjs"), directory],
      { cwd: root, env, timeout: 20000, maxBuffer: 512000 },
    );
    const line = stdout
      .split(/\r?\n/)
      .find((value) => value.startsWith("GORTH_UPDATE_UI="));
    expect(line, stdout).toBeDefined();
    const result = JSON.parse(line!.slice("GORTH_UPDATE_UI=".length));
    expect(result.errors).toEqual([]);
    expect(result.complete).toBe(true);
    expect(result.calls).toEqual(["releases", "check", "download", "install"]);
  } finally {
    await rm(directory, { recursive: true, force: true, maxRetries: 3 });
  }
});
