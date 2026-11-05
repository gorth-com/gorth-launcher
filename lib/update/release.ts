// Stable release channel only; no prerelease or downgrade is offered.
function stableVersion(value: unknown) {
  if (typeof value !== "string") return null;
  const match =
    /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\+[0-9A-Za-z.-]+)?$/.exec(
      value,
    );
  return match
    ? {
        version: match[1] + "." + match[2] + "." + match[3],
        parts: match.slice(1, 4).map(BigInt),
      }
    : null;
}
export function isNewerRelease(candidate: unknown, current: string) {
  const next = stableVersion(candidate),
    previous = stableVersion(current);
  if (!next || !previous) return false;
  for (let i = 0; i < 3; i++) {
    if (next.parts[i] > previous.parts[i]) return true;
    if (next.parts[i] < previous.parts[i]) return false;
  }
  return false;
}
export function releaseVersion(value: unknown) {
  return stableVersion(value)?.version;
}
export function parseRelease(value: unknown, platform: string, arch: string) {
  if (!value || typeof value !== "object") throw new Error("Invalid release");
  const release = value as Record<string, unknown>;
  const version = releaseVersion(release.tag_name);
  if (
    !version ||
    release.draft !== false ||
    release.prerelease !== false ||
    !Array.isArray(release.assets)
  )
    throw new Error("Invalid stable release");
  const names = release.assets.map((asset) =>
    asset && typeof asset === "object" && typeof asset.name === "string"
      ? asset.name.toLowerCase()
      : "",
  );
  const architecture = (name: string) =>
    /-universal(?:[.-]|$)/.test(name)
      ? "universal"
      : /-arm64(?:[.-]|$)/.test(name)
        ? "arm64"
        : /-ia32(?:[.-]|$)/.test(name)
          ? "ia32"
          : "x64";
  const compatible = names.some(
    (name) =>
      (architecture(name) === arch ||
        (platform === "darwin" && architecture(name) === "universal")) &&
      (platform === "darwin"
        ? /-(mac|darwin|osx)[.-]/.test(name) && name.endsWith(".zip")
        : name.endsWith(".exe")),
  );
  const manifest =
    platform !== "win32" ||
    (names.includes("releases") &&
      names.some((name) => name.endsWith("-full.nupkg")));
  if (!compatible || !manifest) throw new Error("No matching update artifact");
  return version;
}
