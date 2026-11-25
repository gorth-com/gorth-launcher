import path from "node:path";
import { readModpackReceipt } from "./packs";
import { contentVersions, providerJson } from "./providers";
import { contentId } from "./schema";
import { projectWebsite } from "./website";
import { gameFolder } from "@/utils/launcher-folders";
import type { Instance } from "@/utils/interface";
import type { ContentQuery, ModpackOverview } from "./interface";

export function modpackQuery(
  instance: Instance,
  provider: ContentQuery["provider"],
): ContentQuery {
  return {
    provider,
    kind: "modpack",
    query: "",
    version: instance.version,
    loader: instance.loader,
    offset: 0,
  };
}
export async function modpackOverview(
  root: string,
  instance: Instance,
  signal: AbortSignal,
): Promise<ModpackOverview | null> {
  const receipt = await readModpackReceipt(
    path.join(gameFolder(root, "instances"), instance.id),
  );
  if (!receipt) return null;
  const result: ModpackOverview = {
    name: receipt.name ?? instance.name,
    currentVersion:
      receipt.packVersion ??
      receipt.source?.versionId ??
      "Không có thông tin phiên bản",
    source: receipt.source,
    versions: [],
  };
  if (!receipt.source) return result;
  try {
    const { provider, projectId, versionId } = receipt.source;
    contentId.parse(projectId);
    contentId.parse(versionId);
    const [project, current, versions] = await Promise.all([
      providerJson<unknown>(
        provider,
        provider === "curseforge"
          ? "/mods/" + projectId
          : "/project/" + projectId,
        signal,
      ),
      providerJson<unknown>(
        provider,
        provider === "curseforge"
          ? "/mods/" + projectId + "/files/" + versionId
          : "/version/" + versionId,
        signal,
      ),
      contentVersions(modpackQuery(instance, provider), projectId, signal),
    ]);
    const p = (
      provider === "curseforge" ? (project as { data: unknown }).data : project
    ) as { name?: string; title?: string; slug: string };
    const v = (
      provider === "curseforge" ? (current as { data: unknown }).data : current
    ) as {
      displayName?: string;
      version_number?: string;
      project_id?: string;
      modId?: number;
    };
    if (
      provider === "modrinth"
        ? v.project_id !== projectId
        : String(v.modId) !== projectId
    )
      throw new Error("Phiên bản không thuộc modpack này.");
    result.name = p.name ?? p.title ?? result.name;
    result.currentVersion =
      receipt.packVersion ??
      v.version_number ??
      v.displayName ??
      result.currentVersion;
    result.website = projectWebsite(provider, "modpack", p.slug);
    result.versions = versions;
  } catch (error) {
    result.onlineError =
      error instanceof Error
        ? error.message
        : "Không tải được thông tin modpack.";
  }
  return result;
}
export async function modpackChangelog(
  root: string,
  instance: Instance,
  versionId: string,
  signal: AbortSignal,
) {
  contentId.parse(versionId);
  const receipt = await readModpackReceipt(
    path.join(gameFolder(root, "instances"), instance.id),
  );
  if (!receipt?.source) throw new Error("Modpack không có nguồn online.");
  const { provider, projectId } = receipt.source;
  contentId.parse(projectId);
  if (provider === "curseforge") {
    const result = await providerJson<{ data: string }>(
      provider,
      "/mods/" + projectId + "/files/" + versionId + "/changelog",
      signal,
    );
    return {
      text: String(result.data).slice(0, 500000),
      format: "html" as const,
    };
  }
  const result = await providerJson<{ project_id: string; changelog?: string }>(
    provider,
    "/version/" + versionId,
    signal,
  );
  if (result.project_id !== projectId)
    throw new Error("Phiên bản không thuộc modpack này.");
  return {
    text: (result.changelog ?? "").slice(0, 500000),
    format: "text" as const,
  };
}
