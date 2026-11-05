import { execFile } from "node:child_process";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { build, createServer, type ViteDevServer } from "vite";
import { expect, it } from "vitest";
import rendererConfig from "../../vite.config.ts";
import { getElectronExecutable } from "../helpers/electron";

it.each(["production", "development"])(
  "loads published UI libraries with Deno's isolated dependencies in %s",
  async (mode) => {
    const root = fileURLToPath(new URL("../../", import.meta.url));
    const directory = await realpath(
      await mkdtemp(path.join(tmpdir(), "gorth-deno-runtime-")),
    );
    let server: ViteDevServer | undefined;
    try {
      const fixture = path.join(root, "tests/fixtures/deno-runtime");
      const config = {
        ...rendererConfig,
        configFile: false as const,
        envDir: false as const,
        root: fixture,
        base: "./",
        cacheDir: path.join(directory, "cache"),
        logLevel: "error" as const,
        server: { host: "127.0.0.1", port: 0, fs: { allow: [root] } },
        build: { outDir: path.join(directory, "renderer"), emptyOutDir: false },
      };
      let target = path.join(directory, "renderer/index.html");
      if (mode === "production") await build(config);
      else {
        server = await createServer(config);
        await server.listen();
        target = server.resolvedUrls!.local[0];
      }
      await build({
        configFile: false,
        envDir: false,
        logLevel: "error",
        build: {
          ssr: path.join(fixture, "main.ts"),
          outDir: directory,
          emptyOutDir: false,
          rolldownOptions: {
            external: ["electron"],
            output: { format: "cjs", entryFileNames: "main.cjs" },
          },
        },
      });
      const env = { ...process.env };
      delete env.ELECTRON_RUN_AS_NODE;
      delete env.NODE_OPTIONS;
      const { stdout } = await promisify(execFile)(
        getElectronExecutable(),
        [path.join(directory, "main.cjs"), directory, target],
        { env, timeout: 20000, maxBuffer: 512000 },
      );
      const result = stdout
        .split(/\r?\n/)
        .find((line) => line.startsWith("GORTH_DENO_RUNTIME="));
      expect(result, stdout).toBeDefined();
      const value = JSON.parse(result!.slice("GORTH_DENO_RUNTIME=".length));
      expect(value.errors).toEqual([]);
      expect(value.ready).toBe(true);
      expect(value.height).toBe(36);
    } finally {
      await server?.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
