import { Worker } from "node:worker_threads";

export interface JarMetadata {
  checksum: string;
  fingerprint: number;
  name?: string;
  version?: string;
}

// Only this fixed application function is evaluated. No JAR code is executed.
// Keeping the worker self-contained also avoids a separate Forge bundle entry.
async function inspectJarWorker() {
  /* oxlint-disable typescript/no-require-imports -- Self-contained CommonJS eval worker; imports would be hoisted outside its function by bundlers. */
  const { parentPort, workerData } =
    require("node:worker_threads") as typeof import("node:worker_threads");
  const { readFile, lstat } =
    require("node:fs/promises") as typeof import("node:fs/promises");
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  const { inflateRawSync } = require("node:zlib") as typeof import("node:zlib");
  /* oxlint-enable typescript/no-require-imports */
  try {
    const info = await lstat(workerData);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 64 * 1024 ** 2)
      throw new Error("Unsupported JAR size or type");
    const bytes = await readFile(workerData);
    if (bytes.length > 64 * 1024 ** 2) throw new Error("JAR too large");
    const checksum = createHash("sha1").update(bytes).digest("hex");
    const filtered = Buffer.allocUnsafe(bytes.length);
    let length = 0;
    for (const byte of bytes)
      if (byte !== 9 && byte !== 10 && byte !== 13 && byte !== 32)
        filtered[length++] = byte;
    let hash = (1 ^ length) >>> 0;
    let index = 0;
    while (index + 4 <= length) {
      let value = filtered.readUInt32LE(index);
      value = Math.imul(value, 0x5bd1e995);
      value ^= value >>> 24;
      value = Math.imul(value, 0x5bd1e995);
      hash = Math.imul(hash, 0x5bd1e995) ^ value;
      index += 4;
    }
    const remaining = length - index;
    if (remaining >= 3) hash ^= filtered[index + 2] << 16;
    if (remaining >= 2) hash ^= filtered[index + 1] << 8;
    if (remaining >= 1) {
      hash ^= filtered[index];
      hash = Math.imul(hash, 0x5bd1e995);
    }
    hash ^= hash >>> 13;
    hash = Math.imul(hash, 0x5bd1e995);
    hash ^= hash >>> 15;
    const result: JarMetadata = { checksum, fingerprint: hash >>> 0 };
    // Read bounded metadata entries directly; never extract to the filesystem.
    let end = bytes.length - 22;
    for (; end >= Math.max(0, bytes.length - 65557); end--)
      if (bytes.readUInt32LE(end) === 0x06054b50) break;
    if (end >= 0 && bytes.readUInt32LE(end) === 0x06054b50) {
      let position = bytes.readUInt32LE(end + 16);
      const count = bytes.readUInt16LE(end + 10);
      for (
        let entry = 0;
        entry < count && position + 46 <= bytes.length;
        entry++
      ) {
        if (bytes.readUInt32LE(position) !== 0x02014b50) break;
        const nameLength = bytes.readUInt16LE(position + 28);
        const name = bytes
          .subarray(position + 46, position + 46 + nameLength)
          .toString("utf8");
        if (
          [
            "fabric.mod.json",
            "META-INF/mods.toml",
            "META-INF/neoforge.mods.toml",
            "mcmod.info",
          ].includes(name)
        ) {
          const size = bytes.readUInt32LE(position + 24);
          const compressed = bytes.readUInt32LE(position + 20);
          const local = bytes.readUInt32LE(position + 42);
          const method = bytes.readUInt16LE(position + 10);
          if (
            size <= 1024 ** 2 &&
            compressed <= 1024 ** 2 &&
            local + 30 <= bytes.length &&
            bytes.readUInt32LE(local) === 0x04034b50 &&
            !(bytes.readUInt16LE(position + 8) & 1)
          ) {
            const start =
              local +
              30 +
              bytes.readUInt16LE(local + 26) +
              bytes.readUInt16LE(local + 28);
            if (start + compressed <= bytes.length && [0, 8].includes(method)) {
              const data = bytes.subarray(start, start + compressed);
              const text = (
                method === 8
                  ? inflateRawSync(data, { maxOutputLength: 1024 ** 2 })
                  : data
              ).toString("utf8");
              if (name.endsWith(".json") || name === "mcmod.info") {
                const parsed = JSON.parse(text);
                const mod = Array.isArray(parsed) ? parsed[0] : parsed;
                result.name =
                  typeof mod?.name === "string"
                    ? mod.name.slice(0, 256)
                    : undefined;
                result.version =
                  typeof mod?.version === "string"
                    ? mod.version.slice(0, 128)
                    : undefined;
              } else {
                const block =
                  text.split(/\[\[mods\]\]/)[1]?.split(/\n\s*\[/)[0] ?? "";
                result.name = /^\s*displayName\s*=\s*["']([^"'\r\n]+)["']/m
                  .exec(block)?.[1]
                  ?.slice(0, 256);
                const version = /^\s*version\s*=\s*["']([^"'\r\n]+)["']/m.exec(
                  block,
                )?.[1];
                if (version && !version.includes("${"))
                  result.version = version.slice(0, 128);
              }
              if (result.name) break;
            }
          }
        }
        position +=
          46 +
          nameLength +
          bytes.readUInt16LE(position + 30) +
          bytes.readUInt16LE(position + 32);
      }
    }
    parentPort?.postMessage(result);
  } catch {
    parentPort?.postMessage(null);
  }
}

let activeWorkers = 0;
const waiting: (() => void)[] = [];
export async function inspectJar(
  filename: string,
): Promise<JarMetadata | null> {
  if (waiting.length >= 100) return null;
  if (activeWorkers >= 2)
    await new Promise<void>((resolve) => waiting.push(resolve));
  else activeWorkers++;
  try {
    return await new Promise((resolve) => {
      const worker = new Worker(`(${inspectJarWorker.toString()})()`, {
        eval: true,
        workerData: filename,
        resourceLimits: { maxOldGenerationSizeMb: 64 },
      });
      let settled = false;
      const finish = (value: JarMetadata | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        void worker.terminate().then(
          () => resolve(value),
          () => resolve(value),
        );
      };
      const timer = setTimeout(() => finish(null), 15_000);
      worker.once("message", finish);
      worker.once("error", () => finish(null));
      worker.once("exit", () => finish(null));
    });
  } finally {
    const next = waiting.shift();
    if (next) next();
    else activeWorkers--;
  }
}
