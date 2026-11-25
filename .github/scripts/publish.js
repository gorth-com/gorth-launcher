import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  appendFile,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { validateReleaseTag } from "./release-artifacts.js";
import { draftPublisherConfig, githubPublisherConfig, uploadReleaseArtifacts } from "./github-publisher.js";

async function sha256(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

export async function verifyRelease(directory, slug) {
  if (!["gorth-browser", "gorth-launcher"].includes(slug))
    throw new Error("Unknown product");
  const required = [
    "darwin-x64.dmg",
    "darwin-arm64.dmg",
    "win32-x64-setup.exe",
    "win32-x64-setup.msi",
    "linux-x64.deb",
    "linux-x64.rpm",
    "darwin-x64.zip",
    "darwin-arm64.zip",
  ].map((suffix) => `${slug}-${suffix}`);
  const files = await readdir(directory);
  const artifacts = files
    .filter(
      (name) =>
        /\.(dmg|zip|exe|msi|deb|rpm|nupkg)$/.test(name) || name === "RELEASES",
    )
    .sort();
  for (const name of [...required, "RELEASES"])
    if (!files.includes(name) || !(await stat(path.join(directory, name))).size)
      throw new Error(`Missing or empty ${name}`);
  if (!artifacts.some((name) => name.endsWith("-full.nupkg")))
    throw new Error("Missing full Squirrel package");
  const verified = new Set();
  for (const target of [
    "darwin-x64",
    "darwin-arm64",
    "win32-x64",
    "linux-x64",
  ]) {
    const manifest = await readFile(
      path.join(directory, `${slug}-${target}-SHA256SUMS.txt`),
      "utf8",
    );
    for (const line of manifest.trim().split(/\r?\n/)) {
      const match = /^([a-f0-9]{64}) {2}([^/\\]+)$/.exec(line);
      if (!match || !artifacts.includes(match[2]))
        throw new Error("Invalid checksum entry");
      if (verified.has(match[2])) throw new Error("Duplicate checksum entry");
      if ((await sha256(path.join(directory, match[2]))) !== match[1])
        throw new Error(`Checksum mismatch: ${match[2]}`);
      verified.add(match[2]);
    }
  }
  if (artifacts.some((name) => !verified.has(name)))
    throw new Error("Unverified release artifact");
  await writeFile(
    path.join(directory, "SHA256SUMS.txt"),
    (
      await Promise.all(
        artifacts.map(
          async (name) =>
            `${await sha256(path.join(directory, name))}  ${name}`,
        ),
      )
    ).join("\n") + "\n",
  );
  return [
    ...artifacts,
    ...files.filter((name) => name.endsWith("-SHA256SUMS.txt")),
    "SHA256SUMS.txt",
  ];
}

function gh(args, capture = false) {
  const result = spawnSync("gh", args, {
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
  });
  if (result.error || result.status !== 0)
    throw new Error("GitHub release command failed");
  return result.stdout;
}

if (import.meta.main) {
  const {
    RELEASE_TAG: tag,
    SLUG: slug,
    RUNNER_TEMP: temporary,
    GH_REPO: repository,
  } = process.env;
  if (!/^v\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(tag || ""))
    throw new Error("Invalid release tag");
  const metadata = JSON.parse(await readFile("package.json", "utf8"));
  validateReleaseTag(tag, metadata.version);
  const publisherConfig = githubPublisherConfig(slug, metadata.version, repository);
  if (!process.env.GITHUB_TOKEN) throw new Error("Missing GITHUB_TOKEN");
  // The publisher may create tags implicitly; require the requested tag first.
  gh(["api", `repos/${repository}/git/ref/tags/${tag}`], true);
  const directory = path.resolve("release-assets");
  const files = await verifyRelease(directory, slug);
  const notes = path.join(temporary, "release-notes.md");
  await writeFile(
    notes,
    `Installers for macOS Intel/Apple Silicon, Windows x64 and Linux x64.\n\nmacOS signing/notarization enabled: ${process.env.MAC_SIGNED}. Windows binaries are unsigned in this workflow. Verify signatures before installing.\n\nWindows MSI is the Squirrel bootstrapper, not a standalone enterprise WiX MSI. Use either EXE or MSI, not both.\n\nChecksums: SHA256SUMS.txt. ZIP/NUPKG/RELEASES are retained for auto-update.\n`,
  );
  // Fail closed on API/auth errors instead of treating every failure as 404.
  const releases = JSON.parse(gh([
    "api", "--paginate", "--slurp", `repos/${repository}/releases?per_page=100`,
  ], true)).flat();
  const existing = releases.find((release) => release.tag_name === tag);
  await uploadReleaseArtifacts(directory, files, metadata,
    draftPublisherConfig(publisherConfig, existing));
  gh([
    "release",
    "edit",
    tag,
    "--title",
    `${slug} ${tag}`,
    "--notes-file",
    notes,
    `--prerelease=${tag.includes("-")}`,
  ]);
  if (process.env.PUBLISH === "true")
    gh([
      "release",
      "edit",
      tag,
      "--draft=false",
      `--latest=${!tag.includes("-")}`,
    ]);
  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    `Release: https://github.com/${repository}/releases/tag/${tag}\n`,
  );
}
