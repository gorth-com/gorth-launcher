import { loaderCatalog } from "@/utils/constant";

export function supportedVanillaVersion(id: string) {
  if (!/^\d+\.\d+(?:\.\d+)?$/.test(id)) return false;
  const [major, minor, patch = 0] = id.split(".").map(Number);
  return (
    major > 1 || (major === 1 && (minor > 7 || (minor === 7 && patch >= 10)))
  );
}

export function supportedRelease(version: { id: string; type: string }) {
  return version.type === "release" && supportedVanillaVersion(version.id);
}

export function supportedLoader(value: {
  loader: string;
  version: string;
  loaderVersion?: string | null;
}) {
  return value.loader === "Vanilla"
    ? !value.loaderVersion && supportedVanillaVersion(value.version)
    : loaderCatalog.some(
        (entry) =>
          entry.loader === value.loader &&
          entry.minecraft === value.version &&
          entry.version === value.loaderVersion,
      );
}
