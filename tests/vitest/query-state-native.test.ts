import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { build } from "esbuild";
import { expect, it } from "vitest";
import { getElectronExecutable } from "../helpers/electron";

it("uses real React Query for settings ordering, IPC races and Launcher auth", async () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const directory = await mkdtemp(path.join(tmpdir(), "gorth-query-state-"));
  const require = createRequire(import.meta.url);
  try {
    await build({
      absWorkingDir: root,
      entryPoints: ["tests/fixtures/query-state/renderer.tsx"],
      bundle: true,
      platform: "browser",
      format: "iife",
      outfile: path.join(directory, "renderer.js"),
      define: {
        "process.env.NODE_ENV": '"development"',
        "import.meta.env": "{}",
      },
      alias: {
        "@gorth-com/primitive/cores/tanstack/query":
          require.resolve("@gorth-com/primitive/cores/tanstack/query"),
        react: path.dirname(require.resolve("react/package.json")),
        "react-dom": path.dirname(require.resolve("react-dom/package.json")),
      },
      plugins: [
        {
          name: "isolated-hook-transports",
          setup(builder) {
            builder.onResolve({ filter: /^@\/lib\/auth\/client$/ }, () => ({
              path: "auth",
              namespace: "mock",
            }));
            builder.onLoad({ filter: /.*/, namespace: "mock" }, () => ({
              contents: "export function resetCallerAuthentication() {}",
            }));
            builder.onResolve({ filter: /^@\/lib\/rpc\/client$/ }, () => ({
              path: path.join(root, "tests/fixtures/query-state/rpc.ts"),
            }));
            builder.onResolve({ filter: /^@\// }, (args) => {
              const base = path.join(root, args.path.slice(2));
              const resolved = [
                base,
                base + ".ts",
                base + ".tsx",
                path.join(base, "index.ts"),
                path.join(base, "index.tsx"),
              ].find(existsSync);
              if (!resolved)
                throw new Error("Missing fixture import: " + args.path);
              return { path: resolved };
            });
          },
        },
      ],
    });
    await build({
      absWorkingDir: root,
      entryPoints: ["tests/fixtures/query-state/main.ts"],
      bundle: true,
      platform: "node",
      format: "esm",
      external: ["electron"],
      outfile: path.join(directory, "main.mjs"),
    });
    await writeFile(
      path.join(directory, "index.html"),
      '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'self\'"><body><script src="./renderer.js"></script></body>',
    );
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.NODE_OPTIONS;
    const { stdout } = await promisify(execFile)(
      getElectronExecutable(),
      [path.join(directory, "main.mjs"), "--use-mock-keychain", directory],
      { env, timeout: 25000, maxBuffer: 512000 },
    );
    const line = stdout
      .split(/\r?\n/)
      .find((line) => line.startsWith("GORTH_QUERY_STATE="));
    expect(line, stdout).toBeDefined();
    expect(JSON.parse(line!.slice("GORTH_QUERY_STATE=".length))).toEqual({
      serializedSettings: true,
      rollback: true,
      gameRace: true,
      launcherAuth: true,
    });
  } catch (error) {
    const failure = error as Error & { stdout?: string; stderr?: string };
    throw new Error(
      [failure.message, failure.stdout, failure.stderr]
        .filter(Boolean)
        .join("\n"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 40000);
