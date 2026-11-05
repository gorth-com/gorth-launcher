import { createReadStream, constants } from "node:fs";
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
export function validateReleaseTag(tag, version) {
  if (
    !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/.test(version) ||
    tag !== `v${version}`
  )
    throw new Error("Release tag must equal v<package.json version>.");
}
export function releaseAssetName(slug, platform, arch, filename) {
  if (!["gorth-browser", "gorth-launcher"].includes(slug))
    throw new Error("Unknown desktop product.");
  if (!(
    (platform === "darwin" && ["x64", "arm64"].includes(arch)) ||
    (["win32", "linux"].includes(platform) && arch === "x64")
  ))
    throw new Error("Unsupported release target.");
  const suffix = path.extname(filename).toLowerCase();
  const prefix = `${slug}-${platform}-${arch}`;
  if (platform === "win32" && (filename === "RELEASES" || suffix === ".nupkg"))
    return filename; // Squirrel manifests refer to these exact package names.
  if (platform === "win32" && [".exe", ".msi"].includes(suffix))
    return `${prefix}-setup${suffix}`;
  if (platform === "darwin" && [".dmg", ".zip"].includes(suffix))
    return prefix + suffix;
  if (platform === "linux" && [".deb", ".rpm"].includes(suffix))
    return prefix + suffix;
  return null;
}
async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) return filesIn(filename);
      return entry.isFile() ? [filename] : []; // Never follow a symlink.
    }),
  );
  return files.flat();
}
export async function stageReleaseArtifacts(root, platform, arch) {
  const metadata = JSON.parse(
    await readFile(path.join(root, "package.json"), "utf8"),
  );
  const slug = String(metadata.productName).toLowerCase().replaceAll(" ", "-");
  releaseAssetName(slug, platform, arch, "validate");
  const files = await filesIn(path.join(root, "out/make"));
  const selected = files.flatMap((file) => {
    const name = releaseAssetName(slug, platform, arch, path.basename(file));
    return name ? [{ file, name }] : [];
  });
  const required =
    platform === "darwin"
      ? [".dmg", ".zip"]
      : platform === "win32"
        ? [".exe", ".msi", "-full.nupkg", "RELEASES"]
        : [".deb", ".rpm"];
  for (const suffix of required)
    if (selected.filter(({ name }) => name.endsWith(suffix)).length !== 1)
      throw new Error(
        `Expected exactly one ${suffix} for ${platform}/${arch}; use a clean build output.`,
      );
  if (new Set(selected.map(({ name }) => name)).size !== selected.length)
    throw new Error("Duplicate release asset names.");
  for (const { file } of selected)
    if ((await stat(file)).size === 0)
      throw new Error("Empty release artifact.");
  if (platform === "win32") {
    const manifest = selected.find(({ name }) => name === "RELEASES");
    const full = selected.find(({ name }) => name.endsWith("-full.nupkg"));
    const entries = (await readFile(manifest.file, "utf8"))
      .trim()
      .split(/\r?\n/);
    if (!entries.some((entry) => entry.trim().split(/\s+/)[1] === full.name))
      throw new Error("Squirrel manifest does not reference the full package.");
  }
  // Exclusive output avoids mixing artifacts from different runs or versions.
  const directory = path.join(root, "out/release", `${platform}-${arch}`);
  await mkdir(path.dirname(directory), { recursive: true });
  await mkdir(directory);
  const checksums = [];
  for (const { file, name } of selected.sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    await copyFile(file, path.join(directory, name), constants.COPYFILE_EXCL);
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(path.join(directory, name)))
      hash.update(chunk);
    checksums.push(`${hash.digest("hex")}  ${name}`);
  }
  await writeFile(
    path.join(directory, `${slug}-${platform}-${arch}-SHA256SUMS.txt`),
    checksums.join("\n") + "\n",
    { flag: "wx" },
  );
  return directory;
}
async function main() {
  const [command, value, arch] = process.argv.slice(2);
  const root = process.cwd();
  if (command === "check") {
    const { version } = JSON.parse(
      await readFile(path.join(root, "package.json"), "utf8"),
    );
    validateReleaseTag(value, version);
  } else {
    console.log(await stageReleaseArtifacts(root, command, arch));
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
  await main();
