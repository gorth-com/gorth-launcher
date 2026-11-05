import path from "node:path";
import { gameFolder } from "@/utils/launcher-folders";
import {
  mkdir,
  rename,
  rm,
  chmod,
  symlink,
  lstat,
  realpath,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { z } from "@gorth-io/structure/cores/zod";
import { download, json, readJson, safePath } from "./files";
import { checkJava } from "./java";
const artifact = z.object({
  url: z.string().url(),
  sha1: z.string().regex(/^[a-f0-9]{40}$/),
  size: z
    .number()
    .int()
    .positive()
    .max(1024 ** 3),
});
export const mojangRuntimeManifestSchema = z.object({
  files: z
    .record(
      z.string(),
      z.discriminatedUnion("type", [
        z.object({ type: z.literal("directory") }),
        z.object({
          type: z.literal("file"),
          executable: z.boolean().optional(),
          downloads: z.object({ raw: artifact }),
        }),
        z.object({
          type: z.literal("link"),
          target: z.string().min(1).max(4096),
        }),
      ]),
    )
    .refine((files) => Object.keys(files).length <= 10000),
});
export function mojangPlatform(
  platform = process.platform,
  arch = process.arch,
) {
  if (arch !== "x64" && arch !== "arm64")
    throw new Error("Unsupported Mojang Java architecture.");
  if (platform === "darwin")
    return arch === "arm64" ? "mac-os-arm64" : "mac-os";
  if (platform === "win32")
    return arch === "arm64" ? "windows-arm64" : "windows-x64";
  if (platform === "linux") return arch === "arm64" ? "linux-arm64" : "linux";
  throw new Error("Mojang Java is unavailable for this platform.");
}
export async function ensureMojangJava(
  root: string,
  major: number,
  requested: string | undefined,
  signal: AbortSignal,
  status: (message: string) => void,
) {
  const component =
    requested ??
    (
      {
        8: "jre-legacy",
        17: "java-runtime-gamma",
        21: "java-runtime-delta",
      } as Record<number, string>
    )[major];
  if (!component || !/^[a-z0-9-]+$/.test(component))
    throw new Error("No Mojang component for Java " + major);
  const platform = mojangPlatform();
  const managed = path.join(
    gameFolder(root, "runtime"),
    "mojang-" + component + "-" + platform,
  );
  const executable =
    process.platform === "darwin"
      ? "jre.bundle/Contents/Home/bin/java"
      : "bin/" + (process.platform === "win32" ? "java.exe" : "java");
  try {
    return await checkJava(safePath(managed, executable), major);
  } catch {
    /* not installed yet */
  }
  status("Downloading Mojang Java " + major);
  const index = await json<unknown>(
    "https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json",
    signal,
  );
  const releases = z
    .record(
      z.string(),
      z.record(z.string(), z.array(z.object({ manifest: artifact }))),
    )
    .parse(index);
  const manifest = releases[platform]?.[component]?.[0]?.manifest;
  if (!manifest)
    throw new Error(
      "Mojang does not provide this runtime/platform. Select a local Java executable.",
    );
  const staging = managed + "." + randomUUID() + ".staging";
  await mkdir(staging, { recursive: true });
  const canonicalStaging = await realpath(staging);
  try {
    const manifestPath = path.join(staging, "runtime-manifest.json");
    await download(manifest, manifestPath, signal);
    const files = Object.entries(
      mojangRuntimeManifestSchema.parse(await readJson(manifestPath)).files,
    );
    if (
      files.reduce(
        (sum, [, value]) =>
          sum + (value.type === "file" ? value.downloads.raw.size : 0),
        0,
      ) >
      2 * 1024 ** 3
    )
      throw new Error("Runtime download is too large.");
    for (const [name] of files) safePath(staging, name);
    let cursor = 0;
    const results = await Promise.allSettled(
      Array.from({ length: 4 }, async () => {
        while (cursor < files.length) {
          signal.throwIfAborted();
          const [name, value] = files[cursor++];
          const destination = safePath(staging, name);
          if (value.type === "directory")
            await mkdir(destination, { recursive: true });
          if (value.type === "file") {
            await download(value.downloads.raw, destination, signal);
            if (value.executable) await chmod(destination, 0o755);
          }
        }
      }),
    );
    const failure = results.find((value) => value.status === "rejected");
    if (failure?.status === "rejected") throw failure.reason;
    for (const [name, value] of files)
      if (value.type === "link") {
        const destination = safePath(staging, name);
        const target = path.resolve(path.dirname(destination), value.target);
        if (
          path.isAbsolute(value.target) ||
          value.target.includes("\\") ||
          !target.startsWith(staging + path.sep)
        )
          throw new Error("Unsafe runtime symlink.");
        // Never create a link through another link in the destination ancestors.
        let parent = staging;
        for (const segment of name.split("/").slice(0, -1)) {
          parent = path.join(parent, segment);
          try {
            const info = await lstat(parent);
            if (info.isSymbolicLink() || !info.isDirectory())
              throw new Error("Unsafe runtime link parent.");
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
            await mkdir(parent);
          }
        }
        await symlink(value.target, destination);
      }
    for (const [name, value] of files)
      if (value.type === "link") {
        const target = await realpath(safePath(staging, name));
        if (!target.startsWith(canonicalStaging + path.sep))
          throw new Error("Runtime symlink escapes its directory.");
      }
    await checkJava(safePath(staging, executable), major);
    try {
      await lstat(managed);
      await rename(managed, managed + "." + randomUUID() + ".old");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await rename(staging, managed);
    return safePath(managed, executable);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}
