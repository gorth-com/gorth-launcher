import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { build } from "esbuild";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));
const run = promisify(execFile);
interface NativeProcessFailure extends Error {
  signal?: NodeJS.Signals;
  stdout?: string;
  stderr?: string;
}
let directory: string | undefined;
let executable: string;

beforeAll(async () => {
  // macOS aborts in LaunchServices before JS starts inside this restricted sandbox.
  if (process.platform === "darwin" && process.env.CODEX_SANDBOX === "seatbelt")
    throw new Error(
      "Native Electron tests require GUI permission outside the Codex sandbox. Run from macOS Terminal or approve an unsandboxed test command.",
    );
  const require = createRequire(import.meta.url);
  const electronRoot = path.dirname(require.resolve("electron/package.json"));
  const pathFile = path.join(electronRoot, "path.txt");
  if (!existsSync(pathFile))
    throw new Error(
      "Electron binary is missing. Run: node node_modules/electron/install.js",
    );
  executable = path.join(
    process.env.ELECTRON_OVERRIDE_DIST_PATH || path.join(electronRoot, "dist"),
    (await readFile(pathFile, "utf8")).trim(),
  );
  if (!existsSync(executable))
    throw new Error("The installed Electron executable is missing.");

  // Electron resolves macOS /var symlinks when loading the bundled fixture.
  directory = await realpath(
    await mkdtemp(path.join(tmpdir(), "gorth-launcher-window-vitest-")),
  );
  const renderer = path.join(directory, "renderer/window-smoke/public");
  await mkdir(renderer, { recursive: true });
  await mkdir(path.join(directory, "profile"));
  await copyFile(
    path.join(root, "tests/fixtures/window/index.html"),
    path.join(renderer, "index.html"),
  );
  await build({
    absWorkingDir: root,
    entryPoints: ["tests/fixtures/window/main.ts"],
    tsconfig: path.join(root, "tsconfig.json"),
    bundle: true,
    platform: "node",
    format: "cjs",
    external: ["electron"],
    outfile: path.join(directory, "build/main.cjs"),
    define: {
      "import.meta.env": "{}",
      MAIN_WINDOW_VITE_DEV_SERVER_URL: '""',
      MAIN_WINDOW_VITE_NAME: '"window-smoke"',
    },
  });
  await build({
    absWorkingDir: root,
    entryPoints: ["tests/fixtures/window/preload.ts"],
    tsconfig: path.join(root, "tsconfig.json"),
    bundle: true,
    platform: "node",
    format: "cjs",
    external: ["electron"],
    outfile: path.join(directory, "build/preload.cjs"),
  });
  await build({
    absWorkingDir: root,
    entryPoints: ["tests/fixtures/window/parent.ts"],
    tsconfig: path.join(root, "tsconfig.json"),
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: path.join(directory, "build/parent.cjs"),
  });
});

afterAll(async () => {
  if (directory)
    await rm(directory, { recursive: true, force: true, maxRetries: 3 });
});

describe("Launcher native window", () => {
  it.each([
    "close",
    "SIGINT",
    "SIGTERM",
    "server-stop",
    "parent-stop",
    "parent-kill",
  ])("opens and gracefully exits the production window (%s)", async (mode) => {
    if (!directory) throw new Error("The native fixture was not built.");
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.NODE_OPTIONS;
    for (const key of Object.keys(env))
      if (key.startsWith("VITE_") || key.startsWith("SSO_")) delete env[key];
    const parentMode = mode.startsWith("parent-");
    const { stdout } = await run(
      parentMode ? process.execPath : executable,
      parentMode
        ? [
            path.join(directory, "build/parent.cjs"),
            mode,
            executable,
            path.join(directory, "build/main.cjs"),
            path.join(directory, "profile"),
          ]
        : [
            path.join(directory, "build/main.cjs"),
            `--smoke-mode=${mode}`,
            path.join(directory, "profile"),
          ],
      {
        cwd: root,
        env,
        timeout: 35_000,
        maxBuffer: 512_000,
      },
    ).catch((error: unknown) => {
      const failure = error as NativeProcessFailure;
      // Only the disposable parent is killed; Electron must still report a clean quit.
      if (
        mode === "parent-kill" &&
        failure.signal === "SIGKILL" &&
        failure.stdout
      )
        return { stdout: failure.stdout };
      throw new Error(
        [failure.message, failure.signal, failure.stdout, failure.stderr]
          .filter(Boolean)
          .join("\n"),
        { cause: error },
      );
    });
    const report = stdout
      .split(/\r?\n/)
      .find((line) => line.startsWith("GORTH_WINDOW_SMOKE="));
    expect(
      report,
      "Electron must report its observable window state",
    ).toBeDefined();
    const result = JSON.parse(
      report!.slice("GORTH_WINDOW_SMOKE=".length),
    ) as Record<string, unknown>;
    expect(result).toMatchObject({
      title: "Gorth Launcher",
      visible: true,
      contextIsolation: true,
      sandbox: true,
      renderer: { loaded: true, bridge: true, nodeHidden: true },
      errors: [],
      reused: true,
      closed: true,
      graceful: { beforeQuit: true, willQuit: true },
      exitCode: 0,
    });
    expect(result.url).toBe(
      pathToFileURL(
        path.join(directory, "renderer/window-smoke/public/index.html"),
      ).href,
    );
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });
});
