import { afterEach, expect, it } from "vitest";
import { mkdtemp, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { readLogPreview } from "@/lib/instance/logs";
const roots: string[] = [];
async function file(name: string, content: Buffer | string) {
  const root = await mkdtemp(path.join(tmpdir(), "gorth-log-"));
  roots.push(root);
  const target = path.join(root, name);
  await writeFile(target, content);
  return target;
}
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
it("reads plain files regardless of extension and compressed .log.gz files", async () => {
  const text = "[INFO] Hello\n[ERROR] <unsafe> stays text";
  for (const [name, bytes] of [
    ["debug.txt", Buffer.from(text)],
    ["old.log.gz", gzipSync(text)],
  ] as const) {
    expect(await readLogPreview(await file(name, bytes))).toEqual({
      content: text,
      truncated: false,
    });
  }
});
it("retains only the last 2 MB and identifies a truncated preview", async () => {
  const content = "x".repeat(3 * 1024 ** 2) + "last line";
  const result = await readLogPreview(
    await file("large.log.gz", gzipSync(content)),
  );
  expect(result.truncated).toBe(true);
  expect(Buffer.byteLength(result.content)).toBe(2 * 1024 ** 2);
  expect(result.content.endsWith("last line")).toBe(true);
});
it("rejects decompression beyond 64 MB", async () => {
  const target = await file(
    "bomb.log.gz",
    gzipSync(Buffer.alloc(65 * 1024 ** 2, 65)),
  );
  await expect(readLogPreview(target)).rejects.toThrow("64 MB");
});
it("rejects symbolic links to files outside the log directory", async () => {
  const target = await file("real.log", "private");
  const link = target + ".link";
  await symlink(target, link);
  await expect(readLogPreview(link)).rejects.toThrow();
});
