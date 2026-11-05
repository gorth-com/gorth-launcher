import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, realpath, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { build } from "esbuild";
import { expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));
const run = promisify(execFile);

it("round-trips the official Better Auth SDK in an isolated real Electron window", async () => {
  if (process.platform === "darwin" && process.env.CODEX_SANDBOX === "seatbelt")
    throw new Error(
      "Native Electron verification requires GUI permission outside the Codex sandbox.",
    );
  const require = createRequire(import.meta.url);
  const electronRoot = path.dirname(require.resolve("electron/package.json"));
  const executable = path.join(
    process.env.ELECTRON_OVERRIDE_DIST_PATH || path.join(electronRoot, "dist"),
    (await readFile(path.join(electronRoot, "path.txt"), "utf8")).trim(),
  );
  const directory = await realpath(
    await mkdtemp(path.join(tmpdir(), "gorth-launcher-auth-vitest-")),
  );
  try {
    const profile = path.join(directory, "profile");
    await mkdir(profile);
    const fixture = path.join(directory, "main.cjs");
    await build({
      absWorkingDir: root,
      entryPoints: ["tests/auth-embedded-native.ts"],
      tsconfig: path.join(root, "tsconfig.json"),
      bundle: true,
      platform: "node",
      format: "cjs",
      external: ["electron"],
      outfile: fixture,
      define: { "import.meta.env": "undefined" },
    });
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.NODE_OPTIONS;
    for (const key of Object.keys(env))
      if (key.startsWith("VITE_") || key.startsWith("SSO_")) delete env[key];
    const { stdout } = await run(executable, [fixture, profile], {
      cwd: root,
      timeout: 105_000,
      killSignal: "SIGTERM",
      maxBuffer: 256_000,
      env: {
        ...env,
        VITE_PUBLIC_OAUTH_CLIENT_ID: "gorth-launcher",
        VITE_PUBLIC_AUTH_URL: "http://localhost:5503",
        VITE_PUBLIC_APP_URL: "http://localhost:5502",
      },
    });
    expect(stdout).toContain(
      "Native auth: official PKCE transfer, secure storage, restore, app-only logout and isolated renderer passed.",
    );
  } finally {
    // Only the disposable fixture profile, after its Electron process exits.
    await rm(directory, { recursive: true, force: true, maxRetries: 3 });
  }
}, 120_000);
