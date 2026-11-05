import { curseforgePaths } from "@/utils/constant";
import type { ContentKind, ContentProvider } from "./interface";

export function projectWebsite(
  provider: ContentProvider,
  kind: ContentKind,
  slug: string,
) {
  if (!/^[a-zA-Z0-9._()~-]{1,200}$/.test(slug) || slug === "." || slug === "..")
    throw new Error("Địa chỉ dự án không hợp lệ.");
  return provider === "modrinth"
    ? `https://modrinth.com/${kind}/${encodeURIComponent(slug)}`
    : `https://www.curseforge.com/minecraft/${curseforgePaths[kind]}/${encodeURIComponent(slug)}`;
}
export function allowedContentWebsite(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port)
      return false;
    return (
      (url.hostname === "modrinth.com" &&
        /^\/(mod|modpack|shader|resourcepack|datapack)\/[a-zA-Z0-9._()~-]+(?:\/|$)/.test(
          url.pathname,
        )) ||
      (url.hostname === "www.curseforge.com" &&
        /^\/minecraft\/(mc-mods|modpacks|shaders|texture-packs|data-packs)\/[a-zA-Z0-9._()~-]+(?:\/|$)/.test(
          url.pathname,
        ))
    );
  } catch {
    return false;
  }
}
