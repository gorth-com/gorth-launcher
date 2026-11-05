import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import config from "../../forge.config";

const manifest = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
);

it("isolates Packager's destructive temp cleanup by app and process", () => {
  expect(config.packagerConfig?.tmpdir).toBe(
    join(tmpdir(), `gorth-launcher-forge-${process.pid}`),
  );
});

it("allows the native DMG tooling dependencies to build during pnpm setup", () => {
  const workspace = readFileSync(
    new URL("../../pnpm-workspace.yaml", import.meta.url),
    "utf8",
  );
  for (const dependency of ["macos-alias", "fs-xattr"]) {
    expect(manifest.pnpm.onlyBuiltDependencies).toContain(dependency);
    expect(workspace).toContain(`  - "${dependency}"`);
  }
});

it.each([
  ["mac:intel", "darwin", "x64", "@electron-forge/maker-dmg"],
  ["mac:arm", "darwin", "arm64", "@electron-forge/maker-dmg"],
  ["windows:exe", "win32", "x64", "squirrel"],
  ["windows:msi", "win32", "x64", "squirrel"],
  ["linux:deb", "linux", "x64", "deb"],
  ["linux:rpm", "linux", "x64", "rpm"],
])("reuses the configured maker for %s", (target, platform, arch, maker) => {
  expect(manifest.scripts[`build:${target}`]).toBe(
    `electron-forge make --platform=${platform} --arch=${arch} --targets=${maker}`,
  );
  expect(
    config.makers?.some((entry) => "name" in entry && entry.name === maker),
  ).toBe(true);
});

it("keeps MSI generation enabled on the configured Squirrel maker", async () => {
  const maker = config.makers?.find((entry) => entry instanceof MakerSquirrel);
  if (!(maker instanceof MakerSquirrel))
    throw new Error("Expected the configured Squirrel instance");
  await maker.prepareConfig("x64");
  expect(maker.config).toMatchObject({
    noMsi: false,
    setupExe: "gorth-launcher-win32-x64-setup.exe",
    setupMsi: "gorth-launcher-win32-x64-setup.msi",
  });
});
