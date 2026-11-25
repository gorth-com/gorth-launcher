import { execFile } from "node:child_process";
import { mkdtemp, mkdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { build } from "esbuild";
import { expect, it } from "vitest";
import { getElectronExecutable } from "../helpers/electron";

it.runIf(process.platform === "darwin")(
  "checks the two encryptors with isolated data and a mock macOS Keychain",
  async () => {
    expect(process.platform).toBe("darwin");
    const directory = await realpath(
      await mkdtemp(path.join(tmpdir(), "gorth-keychain-compat-")),
    );
    try {
      await mkdir(path.join(directory, "profile"));
      const root = fileURLToPath(new URL("../../", import.meta.url));
      await build({
        absWorkingDir: root,
        entryPoints: ["tests/fixtures/keychain-compatibility/main.ts"],
        bundle: true,
        platform: "node",
        format: "cjs",
        external: ["electron"],
        outfile: path.join(directory, "main.cjs"),
      });
      const env = { ...process.env };
      delete env.ELECTRON_RUN_AS_NODE;
      delete env.NODE_OPTIONS;
      const { stdout } = await promisify(execFile)(
        getElectronExecutable(),
        ["--use-mock-keychain", path.join(directory, "main.cjs"), directory],
        { cwd: root, env, timeout: 20000, maxBuffer: 128000 },
      );
      const line = stdout
        .split(/\r?\n/)
        .find((item) => item.startsWith("GORTH_KEYCHAIN_COMPAT="));
      expect(line, stdout).toBeDefined();
      const result = JSON.parse(line!.slice("GORTH_KEYCHAIN_COMPAT=".length));
      console.log("Keychain mock compatibility:", result);
      expect(result.asyncReadsLegacy).toBe(true);
      expect(result.legacyReadsAsync).toBe(true);
      expect(result.legacyPrefix).toBe("v10");
    } finally {
      await rm(directory, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);
