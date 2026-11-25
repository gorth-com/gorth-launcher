import { execFile } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  realpath,
  rm,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { build } from "esbuild";
import { expect, it } from "vitest";
it("opens the instance log through the existing launcher window without creating another window", async () => {
  if (process.platform === "darwin" && process.env.CODEX_SANDBOX === "seatbelt")
    throw new Error("Electron needs GUI permission outside the sandbox.");
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const require = createRequire(import.meta.url);
  const electronRoot = path.dirname(require.resolve("electron/package.json"));
  const electron = path.join(
    electronRoot,
    "dist",
    (await readFile(path.join(electronRoot, "path.txt"), "utf8")).trim(),
  );
  const directory = await realpath(
    await mkdtemp(path.join(tmpdir(), "gorth-game-settings-")),
  );
  try {
    await mkdir(path.join(directory, "profile"));
    await mkdir(path.join(directory, "main"));
    await mkdir(path.join(directory, "renderer/main_window/public"), {
      recursive: true,
    });
    await writeFile(
      path.join(directory, "renderer/main_window/public/index.html"),
      "<!doctype html><title>Isolated console fixture</title>",
    );
    await writeFile(
      path.join(directory, "main/preload.cjs"),
      'const { ipcRenderer } = require("electron"); ipcRenderer.on("game:open-console", (_event, id) => ipcRenderer.send("fixture:console", id));',
    );
    await build({
      absWorkingDir: root,
      entryPoints: ["tests/fixtures/game-settings/main.ts"],
      bundle: true,
      platform: "node",
      format: "cjs",
      external: ["electron"],
      outfile: path.join(directory, "main/main.cjs"),
      define: {
        "import.meta.env": "{}",
        MAIN_WINDOW_VITE_DEV_SERVER_URL: '""',
        MAIN_WINDOW_VITE_NAME: '"main_window"',
      },
    });
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.NODE_OPTIONS;
    delete env.VITE_PUBLIC_APP_URL;
    const { stdout } = await promisify(execFile)(
      electron,
      [path.join(directory, "main/main.cjs"), directory],
      { cwd: root, env, timeout: 15000, maxBuffer: 512000 },
    );
    const line = stdout
      .split(/\r?\n/)
      .find((value) => value.startsWith("GORTH_GAME_SETTINGS="));
    expect(line, stdout).toBeDefined();
    const { errors, result } = JSON.parse(
      line!.slice("GORTH_GAME_SETTINGS=".length),
    );
    expect(errors).toEqual([]);
    expect(result).toEqual({
      visible: true,
      instance: "fixture-instance",
      secure: true,
      reused: true,
      hidden: true,
      restored: true,
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
