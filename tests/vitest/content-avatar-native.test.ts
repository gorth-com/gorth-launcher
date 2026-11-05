import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  build,
  createServer,
  type ViteDevServer,
  type InlineConfig,
} from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { build as bundle } from "esbuild";
import { expect, it } from "vitest";

it.each(["production", "development"])(
  "renders provider avatars in isolated Electron in %s",
  async (mode) => {
    const root = fileURLToPath(new URL("../../", import.meta.url));
    const directory = await realpath(
      await mkdtemp(path.join(tmpdir(), "gorth-content-avatar-")),
    );
    let server: ViteDevServer | undefined;
    try {
      const config: InlineConfig = {
        configFile: false,
        envDir: false,
        logLevel: "error",
        base: "./",
        root: path.join(root, "tests/fixtures/content-avatar"),
        cacheDir: path.join(directory, "cache"),
        plugins: [react(), tailwind()],
        resolve: { alias: { "@": root } },
        build: { outDir: path.join(directory, "renderer") },
      };
      if (mode === "production") await build(config);
      else {
        server = await createServer({
          ...config,
          server: { host: "127.0.0.1", port: 0 },
        });
        await server.listen();
      }
      await bundle({
        absWorkingDir: root,
        entryPoints: ["tests/fixtures/content-avatar/preload.ts"],
        bundle: true,
        platform: "node",
        format: "cjs",
        external: ["electron"],
        outfile: path.join(directory, "preload.cjs"),
      });
      await bundle({
        absWorkingDir: root,
        entryPoints: ["tests/fixtures/content-avatar/main.ts"],
        bundle: true,
        platform: "node",
        format: "cjs",
        external: ["electron"],
        outfile: path.join(directory, "main.cjs"),
      });
      const require = createRequire(import.meta.url);
      const electronRoot = path.dirname(
        require.resolve("electron/package.json"),
      );
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
        [
          path.join(directory, "main.cjs"),
          ...(server ? [server.resolvedUrls!.local[0]] : []),
          directory,
        ],
        { cwd: root, env, timeout: 25000 },
      );
      const line = stdout
        .split(/\r?\n/)
        .find((value) => value.startsWith("GORTH_CONTENT_AVATAR="));
      expect(line, stdout).toBeDefined();
      const data = JSON.parse(line!.slice("GORTH_CONTENT_AVATAR=".length));
      console.log(JSON.stringify(data));
      expect(data.result, JSON.stringify(data)).toHaveLength(4);
      for (const image of data.result) {
        expect(image.image, JSON.stringify(data)).toBe(true);
        expect(image.naturalWidth).toBeGreaterThan(0);
        expect(image.imageWidth).toBeGreaterThan(0);
        expect(image.imageHeight).toBeGreaterThan(0);
      }
    } finally {
      await server?.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
