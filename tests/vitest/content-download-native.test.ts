import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { build } from "esbuild";
import { expect, it } from "vitest";

it("receives a Chromium DownloadItem in a hidden sandboxed window and verifies it", async () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const directory = await mkdtemp(
    path.join(tmpdir(), "gorth-content-download-native-"),
  );
  try {
    const output = path.join(directory, "main.cjs");
    await build({
      absWorkingDir: root,
      entryPoints: ["tests/fixtures/content-download/main.ts"],
      outfile: output,
      bundle: true,
      platform: "node",
      format: "cjs",
      external: ["electron"],
    });
    const require = createRequire(import.meta.url);
    const electronRoot = path.dirname(require.resolve("electron/package.json"));
    const executable = path.join(
      electronRoot,
      "dist",
      (await readFile(path.join(electronRoot, "path.txt"), "utf8")).trim(),
    );
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.NODE_OPTIONS;
    const { stdout } = await promisify(execFile)(
      executable,
      [output, directory],
      { cwd: root, env, timeout: 20_000 },
    );
    expect(stdout).toContain("NATIVE_CONTENT_DOWNLOAD_OK");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
