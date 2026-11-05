import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, realpath, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { build } from "esbuild";
import { expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));
it.runIf(process.platform === "darwin")(
  "returns a macOS URL callback to the original Electron process, not bare Electron.app",
  async () => {
    if (process.env.CODEX_SANDBOX === "seatbelt")
      throw new Error(
        "Native callback verification requires macOS GUI permission outside the sandbox.",
      );
    const require = createRequire(import.meta.url);
    const electronRoot = path.dirname(require.resolve("electron/package.json"));
    // Read explicitly; importing electron in Node may implicitly download it.
    const executable = path.join(
      electronRoot,
      "dist",
      (await readFile(path.join(electronRoot, "path.txt"), "utf8")).trim(),
    );
    // LaunchServices ignores URL handlers inside the OS temporary directory.
    // This exact isolated fixture folder is always removed below.
    const directory = await realpath(
      await mkdtemp(
        path.join(root, "tests/fixtures/auth-callback/gorth-callback-native-"),
      ),
    );
    try {
      await mkdir(path.join(directory, "profile"));
      const fixture = path.join(directory, "main.cjs");
      await build({
        absWorkingDir: root,
        entryPoints: ["tests/fixtures/auth-callback/main.ts"],
        tsconfig: path.join(root, "tsconfig.json"),
        bundle: true,
        platform: "node",
        format: "cjs",
        external: ["electron"],
        outfile: fixture,
      });
      const env = { ...process.env };
      delete env.ELECTRON_RUN_AS_NODE;
      delete env.NODE_OPTIONS;
      const { stdout } = await promisify(execFile)(
        executable,
        [fixture, directory],
        {
          cwd: directory,
          env,
          timeout: 55_000,
          killSignal: "SIGTERM",
          maxBuffer: 256_000,
        },
      );
      const line = stdout
        .split(/\r?\n/)
        .find((value) => value.startsWith("GORTH_CALLBACK_NATIVE="));
      expect(line, stdout).toBeDefined();
      expect(JSON.parse(line!.slice("GORTH_CALLBACK_NATIVE=".length))).toEqual({
        windowLoaded: true,
        received: true,
        count: 1,
        errors: [],
      });
    } finally {
      await rm(directory, { recursive: true, force: true, maxRetries: 3 });
    }
  },
  60_000,
);
