import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { build } from "esbuild";
import { expect, it } from "vitest";

it("applies and persists proxy settings to real Electron transports and future sessions", async () => {
  if (process.platform === "darwin" && process.env.CODEX_SANDBOX === "seatbelt")
    throw new Error("Electron tests require GUI access outside the sandbox.");
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const require = createRequire(import.meta.url);
  const electronRoot = path.dirname(require.resolve("electron/package.json"));
  const executable = path.join(
    electronRoot,
    "dist",
    (await readFile(path.join(electronRoot, "path.txt"), "utf8")).trim(),
  );
  const directory = await realpath(
    await mkdtemp(path.join(tmpdir(), "gorth-proxy-")),
  );
  try {
    await mkdir(path.join(directory, "profile"));
    await build({
      absWorkingDir: root,
      entryPoints: ["tests/fixtures/proxy/main.ts"],
      bundle: true,
      platform: "node",
      format: "cjs",
      external: ["electron"],
      outfile: path.join(directory, "main.cjs"),
      define: {
        "import.meta.env": "{}",
        MAIN_WINDOW_VITE_DEV_SERVER_URL: '""',
        MAIN_WINDOW_VITE_NAME: '"main_window"',
      },
    });
    const env = { ...process.env };
    await build({
      absWorkingDir: root,
      entryPoints: ["tests/fixtures/proxy/preload.ts"],
      bundle: true,
      platform: "node",
      format: "cjs",
      external: ["electron"],
      outfile: path.join(directory, "preload.cjs"),
    });
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.NODE_OPTIONS;
    delete env.VITE_PUBLIC_APP_URL;
    const { stdout } = await promisify(execFile)(
      executable,
      [path.join(directory, "main.cjs"), directory],
      { cwd: root, env, timeout: 20000, maxBuffer: 512000 },
    );
    const line = stdout
      .split(/\r?\n/)
      .find((value) => value.startsWith("GORTH_PROXY="));
    expect(line, stdout).toBeDefined();
    const { errors, result } = JSON.parse(line!.slice("GORTH_PROXY=".length));
    expect(errors).toEqual([]);
    expect(result.route).toMatch(/^PROXY 127\.0\.0\.1:/);
    expect(result.fetch).toBe("through-proxy");
    expect(result.axios).toBe("through-proxy");
    expect(result.local).toBe("local-direct");
    expect(result.futureRoute).toBe(result.route);
    expect(result.future).toBe("through-proxy");
    expect(result.windowRoute).toBe(result.route);
    expect(result.direct).toBe("DIRECT");
    expect(result.redirectRequests).toBe(1);
    expect(result.manualRedirect).toEqual({
      status: 302,
      location: "http://proxy-test.invalid/redirected",
      requests: 1,
    });
    expect(result.manualBody).toBe("through-proxy");
    expect(result.manualAbort).toBe(true);
    expect(result.cookieIsolated).toBe(true);
    expect(result.invalidRejected).toBe(true);
    expect(result.untrustedRejected).toBe(true);
    expect(result.persisted.mode).toBe("http");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
