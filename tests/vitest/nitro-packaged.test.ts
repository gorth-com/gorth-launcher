import { execFile } from "node:child_process";
import { mkdtemp, rm, access, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { build } from "esbuild";
import { expect, it } from "vitest";
import { getElectronExecutable } from "../helpers/electron";

it("loads Nitro routes and renderer assets from the actual Forge app.asar", async () => {
  const manifest = JSON.parse(await readFile("package.json", "utf8"));
  const application = path.join(
    "out",
    manifest.productName + "-" + process.platform + "-" + process.arch,
  );
  const archive = path.resolve(
    process.env.GORTH_TEST_PACKAGE_ASAR ??
      path.join(
        application,
        ...(process.platform === "darwin"
          ? [manifest.productName + ".app", "Contents", "Resources"]
          : ["resources"]),
        "app.asar",
      ),
  );
  await access(archive).catch(() => {
    throw new Error(
      "Package the app first or set GORTH_TEST_PACKAGE_ASAR to the built app.asar",
    );
  });
  const directory = await mkdtemp(
    path.join(tmpdir(), "gorth-nitro-packaged-test-"),
  );
  try {
    const fixture = path.join(directory, "main.cjs");
    await build({
      entryPoints: ["tests/fixtures/nitro-packaged/main.ts"],
      bundle: true,
      platform: "node",
      format: "cjs",
      external: ["electron"],
      outfile: fixture,
    });
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    const result = await promisify(execFile)(
      getElectronExecutable(),
      [fixture, archive, directory],
      { env, timeout: 20000 },
    );
    expect(result.stdout).toContain("PACKAGED_NITRO_ASAR_OK");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 30000);
