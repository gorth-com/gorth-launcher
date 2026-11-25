import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { draftPublisherConfig, githubPublisherConfig, uploadReleaseArtifacts } from "../../.github/scripts/github-publisher.js";

const fixture = vi.hoisted(() => ({ publish: vi.fn().mockResolvedValue(undefined), configs: [] as unknown[] }));
vi.mock("@electron-forge/publisher-github", () => ({
  PublisherGitHub: class {
    constructor(config: unknown) { fixture.configs.push(config); }
    publish = fixture.publish;
  },
}));
afterEach(() => {
  fixture.publish.mockClear();
  fixture.configs.length = 0;
});

it("defaults Forge CLI to non-overwriting uploads without embedding a token", () => {
  expect(githubPublisherConfig("gorth-launcher", "1.2.3", "gorth-io/gorth-launcher")).toEqual({
    repository: { owner: "gorth-io", name: "gorth-launcher" },
    draft: true, prerelease: false, force: false,
  });
  expect(githubPublisherConfig("gorth-launcher", "1.2.3-alpha.1", "gorth-io/gorth-launcher").prerelease).toBe(true);
  expect(() => githubPublisherConfig("unknown", "1.0.0")).toThrow();
  expect(() => githubPublisherConfig("gorth-launcher", "1.0.0", "https://github.com/other/repo")).toThrow();
});

it("permits workflow replacements only for an explicitly confirmed draft", async () => {
  const config = githubPublisherConfig("gorth-launcher", "1.2.3", "gorth-io/gorth-launcher");
  expect(draftPublisherConfig(config, undefined).force).toBe(false);
  expect(() => draftPublisherConfig(config, { draft: false })).toThrow("public release");
  expect(() => draftPublisherConfig(config, {})).toThrow("public release");
  const retry = draftPublisherConfig(config, { draft: true });
  await uploadReleaseArtifacts("/release-assets", ["app.dmg"], { version: "1.2.3" }, retry);
  expect(fixture.configs).toEqual([expect.objectContaining({ force: true })]);
  expect(config.force).toBe(false);
});

it("passes staged installers, update files and checksums to the official publisher without rebuilding", async () => {
  const config = githubPublisherConfig("gorth-launcher", "1.2.3", "gorth-io/gorth-launcher");
  const files = ["app.dmg", "app.zip", "RELEASES", "app-full.nupkg", "SHA256SUMS.txt"];
  const metadata = { version: "1.2.3" };
  await uploadReleaseArtifacts("/release-assets", files, metadata, config);
  expect(fixture.configs).toEqual([config]);
  expect(fixture.publish).toHaveBeenCalledExactlyOnceWith({
    makeResults: [{
      artifacts: files.map((name) => path.join("/release-assets", name)),
      packageJSON: metadata, platform: process.platform, arch: process.arch,
    }],
    setStatusLine: expect.any(Function),
  });
});

it("propagates failed uploads so the workflow cannot promote a partial draft", async () => {
  fixture.publish.mockRejectedValueOnce(new Error("upload failed"));
  await expect(uploadReleaseArtifacts("/release-assets", ["app.zip"], { version: "1.0.0" },
    githubPublisherConfig("gorth-launcher", "1.0.0", "gorth-io/gorth-launcher"))).rejects.toThrow("upload failed");
});
