import { getElectronExecutable } from "../helpers/electron";
import { buildDesktopBackend } from "@/lib/server/build";
import { cp } from "node:fs/promises";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, mkdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { build } from "esbuild";
import { expect, it } from "vitest";
import { getDesktopPipe } from "@/lib/server/pipe";

const root = fileURLToPath(new URL("../../", import.meta.url));
it("opens the dev window and private server without app URL env, using Forge's origin", async () => {
  if (process.platform === "darwin" && process.env.CODEX_SANDBOX === "seatbelt")
    throw new Error("Native startup verification requires GUI permission.");
  const executable = getElectronExecutable();
  const directory = await realpath(
    await mkdtemp(path.join(tmpdir(), "gorth-dev-startup-")),
  );
  const renderer = createServer((_request, response) => {
    response.setHeader("Content-Type", "text/html");
    response.end("<h1>Dev startup fixture</h1>");
  });
  try {
    await mkdir(path.join(directory, "profile"));
    await new Promise<void>((resolve) =>
      renderer.listen(0, "127.0.0.1", resolve),
    );
    const address = renderer.address();
    if (!address || typeof address === "string")
      throw new Error("No renderer port.");
    const origin = `http://127.0.0.1:${address.port}`;
    const fixture = path.join(directory, "main.cjs");
    await buildDesktopBackend(process.cwd());
    await cp(
      path.resolve(".vite/server"),
      path.join(directory, ".vite/server"),
      { recursive: true },
    );
    await build({
      absWorkingDir: root,
      entryPoints: ["tests/fixtures/dev-startup/main.ts"],
      bundle: true,
      platform: "node",
      format: "cjs",
      external: ["electron", "better-sqlite3"],
      outfile: fixture,
      define: {
        "import.meta.env": "{}",
        MAIN_WINDOW_VITE_DEV_SERVER_URL: JSON.stringify(origin),
        MAIN_WINDOW_VITE_NAME: '"main_window"',
      },
    });
    for (const configuredOrigin of ["", "http://localhost:65001"]) {
      const env = { ...process.env };
      delete env.ELECTRON_RUN_AS_NODE;
      delete env.NODE_OPTIONS;
      for (const key of Object.keys(env))
        if (key.startsWith("VITE_")) delete env[key];
      env.VITE_PUBLIC_APP_URL = configuredOrigin;
      const { stdout } = await promisify(execFile)(
        executable,
        [fixture, directory],
        {
          cwd: root,
          env,
          timeout: 20_000,
          killSignal: "SIGTERM",
          maxBuffer: 256_000,
        },
      );
      const line = stdout
        .split(/\r?\n/)
        .find((value) => value.startsWith("GORTH_DEV_STARTUP="));
      expect(line, stdout).toBeDefined();
      expect(JSON.parse(line!.slice("GORTH_DEV_STARTUP=".length))).toEqual({
        loaded: true,
        errors: [],
      });
    }
  } finally {
    await new Promise<void>((resolve) => renderer.close(() => resolve()));
    await rm(directory, { recursive: true, force: true, maxRetries: 3 });
    const pipeDirectory = getDesktopPipe(directory).directory;
    if (pipeDirectory)
      await rm(pipeDirectory, { recursive: true, force: true, maxRetries: 3 });
  }
}, 60_000);
