import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it, vi } from "vitest";
vi.mock("@/lib/instance/archive", () => ({ safeExtract: vi.fn() }));
vi.mock("@/lib/content/install", () => ({ regularDirectory: vi.fn() }));
import { findWorldRoots } from "@/lib/content/world";

it("recognizes root and nested worlds and exposes ambiguous archives for rejection", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "gorth-world-test-"));
  try {
    expect(await findWorldRoots(root)).toEqual([]);
    await mkdir(path.join(root, "first"));
    await writeFile(path.join(root, "first", "level.dat"), "fixture");
    expect(await findWorldRoots(root)).toEqual([path.join(root, "first")]);
    await mkdir(path.join(root, "second"));
    await writeFile(path.join(root, "second", "level.dat"), "fixture");
    expect(await findWorldRoots(root)).toHaveLength(2);
    await writeFile(path.join(root, "level.dat"), "fixture");
    expect(await findWorldRoots(root)).toEqual([root]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
