import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  readdir,
  copyFile,
} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { afterEach, expect, it } from "vitest";
import {
  releaseAssetName,
  stageReleaseArtifacts,
  validateReleaseTag,
} from "../../.github/scripts/release-artifacts.js";
import { verifyRelease } from "../../.github/scripts/publish.js";

const roots: string[] = [];
it("verifies all platform manifests and rejects a modified release asset", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "gorth-release-complete-"),
  );
  roots.push(directory);
  for (const [platform, arch, names] of [
    ["darwin", "x64", ["app.dmg", "app.zip"]],
    ["darwin", "arm64", ["app.dmg", "app.zip"]],
    ["linux", "x64", ["app.deb", "app.rpm"]],
    [
      "win32",
      "x64",
      ["Setup.exe", "Setup.msi", "RELEASES", "gorth_browser-1.0.0-full.nupkg"],
    ],
  ] as const) {
    const source = await fixture([...names]);
    const staged = await stageReleaseArtifacts(source, platform, arch);
    for (const name of await readdir(staged))
      await copyFile(path.join(staged, name), path.join(directory, name));
  }
  const files = await verifyRelease(directory, "gorth-browser");
  expect(files).toContain("SHA256SUMS.txt");
  expect(files).toContain("RELEASES");
  await writeFile(
    path.join(directory, "gorth-browser-linux-x64.deb"),
    "tampered",
  );
  await expect(verifyRelease(directory, "gorth-browser")).rejects.toThrow(
    "Checksum mismatch",
  );
  await rm(path.join(directory, "gorth-browser-darwin-arm64.dmg"));
  await expect(verifyRelease(directory, "gorth-browser")).rejects.toThrow(
    "Missing or empty",
  );
});
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
async function fixture(names: string[]) {
  const root = await mkdtemp(path.join(os.tmpdir(), "gorth-release-test-"));
  roots.push(root);
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({ productName: "Gorth Browser", version: "1.0.0" }),
  );
  await mkdir(path.join(root, "out/make"), { recursive: true });
  for (const name of names)
    await writeFile(
      path.join(root, "out/make", name),
      name === "RELEASES"
        ? "abc gorth_browser-1.0.0-full.nupkg 7\n"
        : "fixture",
    );
  return root;
}
it("requires an exact version/tag pair, including prereleases", () => {
  expect(() => validateReleaseTag("v1.2.3", "1.2.3")).not.toThrow();
  expect(() =>
    validateReleaseTag("v0.0.0-alpha.1", "0.0.0-alpha.1"),
  ).not.toThrow();
  expect(() => validateReleaseTag("v1.2.4", "1.2.3")).toThrow();
  expect(() => validateReleaseTag("vnext", "next")).toThrow();
});
it("uses stable download names but preserves Squirrel filenames", () => {
  expect(
    releaseAssetName("gorth-launcher", "darwin", "arm64", "Launcher.dmg"),
  ).toBe("gorth-launcher-darwin-arm64.dmg");
  expect(releaseAssetName("gorth-browser", "win32", "x64", "Setup.msi")).toBe(
    "gorth-browser-win32-x64-setup.msi",
  );
  expect(
    releaseAssetName(
      "gorth-browser",
      "win32",
      "x64",
      "gorth_browser-1.0.0-full.nupkg",
    ),
  ).toBe("gorth_browser-1.0.0-full.nupkg");
  expect(() =>
    releaseAssetName("unknown", "darwin", "arm64", "app.dmg"),
  ).toThrow();
  expect(() =>
    releaseAssetName("gorth-browser", "linux", "arm64", "app.deb"),
  ).toThrow();
});
it.each([
  ["darwin", "arm64", ["app.dmg", "app.zip"]],
  ["darwin", "x64", ["app.dmg", "app.zip"]],
  ["linux", "x64", ["app.deb", "app.rpm"]],
  [
    "win32",
    "x64",
    ["Setup.exe", "Setup.msi", "RELEASES", "gorth_browser-1.0.0-full.nupkg"],
  ],
])(
  "stages %s/%s with hashes and leaves the original output intact",
  async (platform, arch, names) => {
    const root = await fixture(names as string[]);
    const output = await stageReleaseArtifacts(
      root,
      platform as string,
      arch as string,
    );
    const hashes = await readFile(
      path.join(output, `gorth-browser-${platform}-${arch}-SHA256SUMS.txt`),
      "utf8",
    );
    expect(hashes.trim().split("\n")).toHaveLength(names.length);
    expect(hashes).toMatch(/^[a-f0-9]{64}  /);
    expect(
      await readFile(path.join(root, "out/make", names[0]), "utf8"),
    ).not.toBe("");
    await expect(
      stageReleaseArtifacts(root, platform as string, arch as string),
    ).rejects.toThrow();
  },
);
it("rejects incomplete, duplicate, empty and inconsistent update artifacts", async () => {
  await expect(
    stageReleaseArtifacts(await fixture(["app.dmg"]), "darwin", "x64"),
  ).rejects.toThrow("exactly one");
  await expect(
    stageReleaseArtifacts(
      await fixture(["app.dmg", "app.zip", "other.zip"]),
      "darwin",
      "arm64",
    ),
  ).rejects.toThrow("exactly one");
  const empty = await fixture(["app.deb", "app.rpm"]);
  await writeFile(path.join(empty, "out/make/app.deb"), "");
  await expect(stageReleaseArtifacts(empty, "linux", "x64")).rejects.toThrow(
    "Empty",
  );
  const bad = await fixture([
    "Setup.exe",
    "Setup.msi",
    "RELEASES",
    "gorth_browser-1.0.0-full.nupkg",
  ]);
  await writeFile(path.join(bad, "out/make/RELEASES"), "abc wrong.nupkg 7");
  await expect(stageReleaseArtifacts(bad, "win32", "x64")).rejects.toThrow(
    "manifest",
  );
});
