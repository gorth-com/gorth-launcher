// Shared by Forge CLI and the cross-platform release aggregation job.
export function githubPublisherConfig(slug, version, repository = process.env.GITHUB_REPOSITORY || `gorth-io/${slug}`) {
  if (!["gorth-browser", "gorth-launcher"].includes(slug))
    throw new Error("Unknown product");
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository))
    throw new Error("Invalid GitHub repository");
  const [owner, name] = repository.split("/");
  return {
    repository: { owner, name },
    draft: true,
    prerelease: version.includes("-"),
    force: false,
  };
}

// Only the aggregation workflow may replace assets, after checking GitHub.
// draft:true alone does not protect an existing public release in Forge.
export function draftPublisherConfig(config, release) {
  if (release && release.draft !== true)
    throw new Error("Refusing to overwrite a public release");
  return { ...config, force: release?.draft === true };
}

export async function uploadReleaseArtifacts(directory, files, metadata, config) {
  const { PublisherGitHub } = await import("@electron-forge/publisher-github");
  const path = await import("node:path");
  const publisher = new PublisherGitHub(config);
  // All native builds have completed and verifyRelease has checked their hashes.
  // Upload staged files directly; do not rebuild macOS/Windows artifacts on Linux.
  await publisher.publish({
    makeResults: [{
      artifacts: files.map((name) => path.join(directory, name)),
      packageJSON: metadata,
      platform: process.platform,
      arch: process.arch,
    }],
    setStatusLine: (message) => console.log(message),
  });
}
