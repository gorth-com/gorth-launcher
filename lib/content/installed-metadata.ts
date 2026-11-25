import path from "node:path";
import { lstat, readFile, writeFile, rename, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { z } from "@gorth-com/structure/cores/zod";
import { inspectJar, type JarMetadata } from "./jar-metadata";
import { providerJson, hasCurseForgeKey } from "./providers";
import { contentPath } from "./packs";
import { projectWebsite } from "./website";
import type {
  ContentInventory,
  ContentProvider,
  InstalledModMetadata,
} from "./interface";

const id = z
  .union([
    z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
    z.number().int().nonnegative(),
  ])
  .transform(String);
const https = z
  .string()
  .max(8192)
  .url()
  .refine((value) => new URL(value).protocol === "https:");
const metadataSchema = z.object({
  provider: z.enum(["curseforge", "modrinth"]).optional(),
  projectId: id.optional(),
  versionId: id.optional(),
  versionName: z.string().max(512).optional(),
  project: z.object({
    id,
    name: z.string().max(512),
    url: z.union([https, z.literal("")]),
    description: z.string().max(8192),
    downloads: z.number().nonnegative(),
    iconUrl: https.optional(),
    author: z.string().max(512).optional(),
  }),
});
const cacheSchema = z.record(
  z.string(),
  z.object({ at: z.number(), metadata: metadataSchema }),
);

export async function identifyInstalledMods(
  instanceRoot: string,
  inventory: ContentInventory,
): Promise<ContentInventory> {
  const filename = path.join(instanceRoot, ".gorth-mod-metadata.json");
  let cache: z.infer<typeof cacheSchema> = {};
  try {
    const info = await lstat(filename);
    if (info.isFile() && !info.isSymbolicLink() && info.size <= 4 * 1024 ** 2)
      cache = cacheSchema.parse(JSON.parse(await readFile(filename, "utf8")));
  } catch {
    /* An invalid cache must not prevent local inventory. */
  }
  const signal = AbortSignal.timeout(5 * 60_000);
  let onlineFailed = false;
  const providerFor = (item: ContentInventory["items"][number]) =>
    item.provider ?? item.origin?.provider;
  const identityFor = (item: ContentInventory["items"][number]) => {
    const provider = providerFor(item),
      projectId = item.projectId ?? item.origin?.projectId,
      versionId = item.versionId ?? item.origin?.versionId;
    return !item.modified && provider && projectId && versionId
      ? { provider, projectId, versionId }
      : undefined;
  };
  const keyFor = (item: ContentInventory["items"][number]) =>
    `${item.checksum}:${providerFor(item) ?? "unknown"}:${item.projectId ?? item.origin?.projectId ?? ""}:${item.versionId ?? item.origin?.versionId ?? ""}`;
  const scans = new Map<string, JarMetadata>();
  const pending = inventory.items.filter(
    (item) => item.kind === "mod" && /\.jar$/i.test(item.filename),
  );
  for (let index = 0; index < pending.length; index += 2) {
    if (signal.aborted) break;
    await Promise.all(
      pending.slice(index, index + 2).map(async (item) => {
        const saved = cache[keyFor(item)];
        if (saved) item.metadata = saved.metadata;
        if (saved?.metadata.provider && Date.now() - saved.at < 86400_000)
          return;
        if (identityFor(item)) return;
        const scan = await inspectJar(
          contentPath(
            instanceRoot,
            `game/mods/${item.filename}${item.enabled ? "" : ".disabled"}`,
          ),
        );
        if (scan && scan.checksum === item.checksum) {
          scans.set(item.id, scan);
          if (!item.metadata && scan.name)
            item.metadata = {
              project: {
                id: item.id,
                name: scan.name,
                description: item.filename,
                downloads: 0,
                url: "",
              },
              versionName: scan.version,
            };
        }
      }),
    );
  }
  const matches = new Map<
    string,
    { provider: ContentProvider; projectId: string; versionId: string }
  >();
  const unknown = pending.filter(
    (item) => !!item.checksum && !identityFor(item),
  );
  const cf = unknown.filter(
    (item) => scans.has(item.id) && providerFor(item) !== "modrinth",
  );
  if (cf.length && hasCurseForgeKey()) {
    try {
      for (let start = 0; start < cf.length; start += 100) {
        const batch = cf.slice(start, start + 100);
        const result = await providerJson<{
          data: { exactMatches: unknown[] };
        }>("curseforge", "/fingerprints/432", signal, {
          fingerprints: batch.map((item) => scans.get(item.id)!.fingerprint),
        });
        for (const raw of result.data.exactMatches) {
          const file = z
            .object({
              file: z.object({
                id,
                modId: id,
                fileFingerprint: z.number(),
                hashes: z.array(
                  z.object({ algo: z.number(), value: z.string() }),
                ),
              }),
            })
            .parse(raw).file;
          for (const item of batch)
            if (
              file.fileFingerprint === scans.get(item.id)!.fingerprint &&
              file.hashes.some(
                (hash) =>
                  hash.algo === 1 && hash.value.toLowerCase() === item.checksum,
              )
            )
              matches.set(item.id, {
                provider: "curseforge",
                projectId: file.modId,
                versionId: file.id,
              });
        }
      }
    } catch {
      onlineFailed = true;
    }
  }
  const mr = unknown.filter(
    (item) => !matches.has(item.id) && providerFor(item) !== "curseforge",
  );
  if (mr.length) {
    try {
      for (let start = 0; start < mr.length; start += 100) {
        const batch = mr.slice(start, start + 100);
        const result = await providerJson<Record<string, unknown>>(
          "modrinth",
          "/version_files",
          signal,
          { hashes: batch.map((item) => item.checksum), algorithm: "sha1" },
        );
        for (const item of batch) {
          const parsed = z
            .object({
              id,
              project_id: id,
              files: z.array(
                z.object({ hashes: z.object({ sha1: z.string() }) }),
              ),
            })
            .safeParse(result[item.checksum!]);
          if (
            parsed.success &&
            parsed.data.files.some((file) => file.hashes.sha1 === item.checksum)
          )
            matches.set(item.id, {
              provider: "modrinth",
              projectId: parsed.data.project_id,
              versionId: parsed.data.id,
            });
        }
      }
    } catch {
      onlineFailed = true;
    }
  }
  const requests = new Map<string, Promise<unknown>>();
  const request = (provider: ContentProvider, route: string) => {
    const key = provider + route;
    if (!requests.has(key))
      requests.set(key, providerJson(provider, route, signal));
    return requests.get(key)!;
  };
  for (let index = 0; index < pending.length; index += 2) {
    if (signal.aborted) break;
    await Promise.all(
      pending.slice(index, index + 2).map(async (item) => {
        const key = keyFor(item);
        if (
          cache[key]?.metadata.provider &&
          Date.now() - cache[key].at < 86400_000
        )
          return;
        const source = identityFor(item) ?? matches.get(item.id);
        if (!source) return;
        try {
          const projectId = id.parse(source.projectId),
            versionId = id.parse(source.versionId);
          let metadata: InstalledModMetadata;
          if (source.provider === "curseforge") {
            const project = z
              .object({
                data: z.object({
                  id,
                  name: z.string(),
                  slug: z.string(),
                  summary: z.string(),
                  downloadCount: z.number(),
                  logo: z.object({ thumbnailUrl: https }).nullable().optional(),
                  authors: z.array(z.object({ name: z.string() })).optional(),
                }),
              })
              .parse(await request("curseforge", `/mods/${projectId}`)).data;
            const version = z
              .object({
                data: z.object({ displayName: z.string(), modId: id }),
              })
              .parse(
                await request(
                  "curseforge",
                  `/mods/${projectId}/files/${versionId}`,
                ),
              ).data;
            if (version.modId !== projectId || project.id !== projectId)
              throw new Error("Identity mismatch");
            metadata = {
              ...source,
              versionName: version.displayName,
              project: {
                id: projectId,
                name: project.name,
                description: project.summary,
                downloads: project.downloadCount,
                url: projectWebsite("curseforge", "mod", project.slug),
                iconUrl: project.logo?.thumbnailUrl,
                author: project.authors?.map((a) => a.name).join(", "),
              },
            };
          } else {
            const project = z
              .object({
                id,
                title: z.string(),
                slug: z.string(),
                description: z.string(),
                downloads: z.number(),
                icon_url: https.nullable().optional(),
                team: id.optional(),
              })
              .parse(await request("modrinth", `/project/${projectId}`));
            const version = z
              .object({ project_id: id, version_number: z.string() })
              .parse(await request("modrinth", `/version/${versionId}`));
            if (project.id !== projectId || version.project_id !== projectId)
              throw new Error("Identity mismatch");
            let author: string | undefined;
            if (project.team) {
              try {
                const members = z
                  .array(z.object({ user: z.object({ username: z.string() }) }))
                  .parse(
                    await request("modrinth", `/team/${project.team}/members`),
                  );
                author = members
                  .map((member) => member.user.username)
                  .join(", ")
                  .slice(0, 512);
              } catch {
                onlineFailed = true;
              }
            }
            metadata = {
              ...source,
              versionName: version.version_number,
              project: {
                id: projectId,
                name: project.title,
                description: project.description,
                downloads: project.downloads,
                url: projectWebsite("modrinth", "mod", project.slug),
                iconUrl: project.icon_url ?? undefined,
                author,
              },
            };
          }
          item.metadata = metadataSchema.parse(metadata);
          cache[key] = { at: Date.now(), metadata: item.metadata };
        } catch {
          onlineFailed = true;
        }
      }),
    );
  }
  const serialized = JSON.stringify(
    Object.fromEntries(
      Object.entries(cache)
        .sort((a, b) => b[1].at - a[1].at)
        .slice(0, 2000),
    ),
  );
  if (Buffer.byteLength(serialized) <= 4 * 1024 ** 2) {
    const temporary = filename + "." + randomUUID() + ".tmp";
    try {
      await writeFile(temporary, serialized, { flag: "wx", mode: 0o600 });
      await rename(temporary, filename);
    } catch {
      onlineFailed = true;
    } finally {
      await rm(temporary, { force: true });
    }
  }
  return {
    ...inventory,
    metadataError: onlineFailed
      ? "Một số metadata online chưa tải được. Đang giữ thông tin local/cache; hãy tải lại để thử lại."
      : undefined,
  };
}
