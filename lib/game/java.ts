import path from "node:path";
import { gameFolder } from "@/utils/launcher-folders";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  mkdir,
  readdir,
  rename,
  rm,
  stat,
  access,
  realpath,
} from "node:fs/promises";
import { constants } from "node:fs";
import type {
  JavaInstallation,
  JavaPreferences,
} from "@/lib/library/game-preferences";
import extract from "extract-zip";
import { download, json } from "./files";
import { javaHome, getJavaEnvironment } from "@/utils/environment";
const exec = promisify(execFile);
export async function inspectJava(
  file: string,
  args: string[] = [],
): Promise<JavaInstallation> {
  if (!path.isAbsolute(file) || !(await stat(file)).isFile())
    throw new Error("Select an absolute Java executable path.");
  const { stdout, stderr } = await exec(
    file,
    [...args, "-XshowSettings:properties", "-version"],
    { timeout: 15_000, env: getJavaEnvironment(), maxBuffer: 128 * 1024 },
  );
  const output = stdout + stderr;
  const version = /java\.version\s*=\s*(\S+)/.exec(output)?.[1] ?? "";
  const major = Number(
    version.startsWith("1.")
      ? version.split(".")[1]
      : version.split(/[.+_-]/)[0],
  );
  if (!Number.isInteger(major) || major < 8)
    throw new Error("Java 8 or newer is required.");
  return {
    path: file,
    version,
    major,
    vendor:
      /java\.vendor\s*=\s*([^\r\n]+)/.exec(output)?.[1]?.trim() ?? "Unknown",
    architecture: /os\.arch\s*=\s*(\S+)/.exec(output)?.[1] ?? "",
  };
}
export async function checkJava(file: string, major = 17) {
  const info = await inspectJava(file);
  if (info.major !== major)
    throw new Error(
      "Java " + major + " is required for this Minecraft version.",
    );
  const arch = info.architecture;
  if (
    process.arch === "arm64"
      ? arch !== "aarch64"
      : !["amd64", "x86_64"].includes(arch ?? "")
  )
    throw new Error("Java architecture must match the launcher (x64/ARM64).");
  return file;
}
async function findJava(
  root: string,
  major: number,
  depth = 4,
): Promise<string | null> {
  const direct = path.join(
    root,
    "bin",
    process.platform === "win32" ? "java.exe" : "java",
  );
  try {
    return await checkJava(direct, major);
  } catch {
    /* try nested runtime folders */
  }
  if (!depth) return null;
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries)
    if (entry.isDirectory()) {
      const found = await findJava(
        path.join(root, entry.name),
        major,
        depth - 1,
      );
      if (found) return found;
    }
  return null;
}
export async function ensureJava(
  root: string,
  custom: string,
  signal: AbortSignal,
  status: (message: string) => void,
  major = 17,
  options?: JavaPreferences,
  component?: string,
) {
  if (custom && options?.skipCompatibilityChecks) {
    if (!path.isAbsolute(custom) || !(await stat(custom)).isFile())
      throw new Error("Invalid Java executable.");
    await access(
      custom,
      process.platform === "win32" ? constants.F_OK : constants.X_OK,
    );
    return custom;
  }
  if (custom) {
    if (!path.isAbsolute(custom))
      throw new Error("Đường dẫn Java phải là đường dẫn tuyệt đối.");
    try {
      return await checkJava(custom, major);
    } catch (error) {
      if (!options?.autoDetect) throw error;
    }
  }
  const candidates: string[] = [];
  if (javaHome)
    candidates.push(
      path.join(
        javaHome,
        "bin",
        process.platform === "win32" ? "java.exe" : "java",
      ),
    );
  if (process.platform === "darwin") {
    try {
      const { stdout } = await exec(
        "/usr/libexec/java_home",
        ["-v", major === 8 ? "1.8" : String(major), "-F"],
        { timeout: 5000 },
      );
      candidates.push(path.join(stdout.trim(), "bin/java"));
    } catch {
      /* download if absent */
    }
  }
  if (options?.autoDetect) {
    for (const installation of await discoverJava(root))
      if (installation.major === major) candidates.push(installation.path);
  }
  for (const candidate of options?.autoDetect === false ? [] : candidates)
    try {
      return await checkJava(candidate, major);
    } catch {
      /* only Temurin 17 */
    }
  const managed = path.join(
    gameFolder(root, "runtime"),
    "temurin-" + major + "-" + process.platform + "-" + process.arch,
  );
  const existing = await findJava(managed, major);
  if (existing) return existing;
  if (options?.autoDownloadMojang) {
    const { ensureMojangJava } = await import("./mojang-java");
    return ensureMojangJava(root, major, component, signal, status);
  }
  if (
    !["x64", "arm64"].includes(process.arch) ||
    !["win32", "darwin", "linux"].includes(process.platform)
  )
    throw new Error("Nền tảng chưa hỗ trợ Temurin tự động.");
  status("Đang tải Eclipse Temurin " + major + "…");
  const osName =
    process.platform === "darwin"
      ? "mac"
      : process.platform === "win32"
        ? "windows"
        : "linux";
  const arch = process.arch === "arm64" ? "aarch64" : "x64";
  const releases = await json<
    {
      binary: {
        package: { link: string; checksum: string; size: number; name: string };
      };
    }[]
  >(
    "https://api.adoptium.net/v3/assets/latest/" +
      major +
      "/hotspot?architecture=" +
      arch +
      "&image_type=jre&os=" +
      osName +
      "&vendor=eclipse",
    signal,
  );
  const archive = releases[0]?.binary.package;
  if (!archive)
    throw new Error("Không tìm thấy Temurin " + major + " phù hợp.");
  const archivePath = path.join(
    gameFolder(root, "runtime"),
    "temurin-" +
      major +
      "-" +
      osName +
      "-" +
      arch +
      (osName === "windows" ? ".zip" : ".tar.gz"),
  );
  await download(
    { url: archive.link, sha256: archive.checksum, size: archive.size },
    archivePath,
    signal,
  );
  const staging = managed + ".staging";
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  try {
    if (osName === "windows") await extract(archivePath, { dir: staging });
    else
      await exec("/usr/bin/tar", ["-xzf", archivePath, "-C", staging], {
        signal,
        timeout: 120_000,
      });
    signal.throwIfAborted();
    const found = await findJava(staging, major);
    if (!found) throw new Error("Temurin tải về không hợp lệ.");
    const relative = path.relative(staging, found);
    await rm(managed, { recursive: true, force: true });
    await rename(staging, managed);
    return path.join(managed, relative);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}
export function memoryLimit(value: number) {
  const limit = Math.max(
    1,
    Math.min(64, Math.floor(os.totalmem() / 1024 ** 3) - 2),
  );
  if (
    !Number.isFinite(value) ||
    !Number.isInteger(value * 1024) ||
    value < 0.125 ||
    value > limit
  )
    throw new Error("RAM phải nằm trong khoảng 128 MiB–" + limit + " GB.");
  return value;
}

/** Bounded discovery; never runs executables from arbitrary filesystem trees. */
export async function discoverJava(root: string): Promise<JavaInstallation[]> {
  const candidates = new Set<string>();
  if (javaHome)
    candidates.add(
      path.join(
        javaHome,
        "bin",
        process.platform === "win32" ? "java.exe" : "java",
      ),
    );
  const bases = [
    gameFolder(root, "runtime"),
    path.join(os.homedir(), ".sdkman/candidates/java"),
    path.join(os.homedir(), ".jenv/versions"),
    ...(process.platform === "darwin"
      ? [
          "/Library/Java/JavaVirtualMachines",
          path.join(os.homedir(), "Library/Java/JavaVirtualMachines"),
          "/opt/local/Library/Java/JavaVirtualMachines",
        ]
      : process.platform === "linux"
        ? ["/usr/lib/jvm", "/usr/java"]
        : []),
  ];
  for (const directory of (getJavaEnvironment().PATH ?? "").split(
    path.delimiter,
  )) {
    if (path.isAbsolute(directory))
      candidates.add(
        path.join(
          directory,
          process.platform === "win32" ? "java.exe" : "java",
        ),
      );
  }
  const systemCandidates = new Set(candidates);
  if (process.platform === "darwin") {
    for (const directory of ["/opt/homebrew/opt", "/usr/local/opt"]) {
      try {
        for (const entry of await readdir(directory)) {
          if (/^(openjdk|temurin|zulu)(@|$)/.test(entry))
            bases.push(path.join(directory, entry));
        }
      } catch {
        /* package manager is not installed */
      }
    }
  }
  if (process.platform === "win32") {
    const environment = getJavaEnvironment();
    for (const base of [
      environment.ProgramFiles,
      environment["ProgramFiles(x86)"],
    ]) {
      if (base && path.isAbsolute(base))
        for (const vendor of ["Java", "Eclipse Adoptium", "Microsoft"])
          bases.push(path.join(base, vendor));
    }
  }
  const visited = new Set<string>();
  const walk = async (directory: string, depth: number) => {
    try {
      const resolved = await realpath(directory);
      if (visited.has(resolved) || visited.size >= 4096) return;
      visited.add(resolved);
    } catch {
      return;
    }
    const executable = path.join(
      directory,
      "bin",
      process.platform === "win32" ? "java.exe" : "java",
    );
    try {
      if ((await stat(executable)).isFile()) candidates.add(executable);
    } catch {
      /* not a runtime root */
    }
    if (!depth) return;
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries)
      if (entry.isDirectory() || entry.isSymbolicLink())
        await walk(path.join(directory, entry.name), depth - 1);
  };
  for (const base of bases) await walk(base, 5);
  if (process.platform === "darwin") {
    try {
      const { stdout, stderr } = await exec("/usr/libexec/java_home", ["-V"], {
        timeout: 5000,
        env: getJavaEnvironment(),
      });
      for (const match of (stdout + "\n" + stderr).matchAll(
        /(\/[^\r\n]*\/Contents\/Home)\s*$/gm,
      ))
        candidates.add(path.join(match[1].trim(), "bin/java"));
    } catch {
      /* no system Java */
    }
  }
  const found: JavaInstallation[] = [];
  const inspected = new Set<string>();
  for (const candidate of candidates) {
    try {
      const resolved = await realpath(candidate);
      if (inspected.has(resolved)) continue;
      inspected.add(resolved);
      const installation = await inspectJava(candidate);
      installation.systemDefault =
        systemCandidates.has(candidate) &&
        !found.some((item) => item.systemDefault);
      found.push(installation);
    } catch {
      /* invalid installations are not selectable */
    }
  }
  return found.sort(
    (a, b) =>
      b.major - a.major ||
      b.version.localeCompare(a.version, undefined, { numeric: true }) ||
      a.vendor.localeCompare(b.vendor) ||
      a.path.localeCompare(b.path),
  );
}
