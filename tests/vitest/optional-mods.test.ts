import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  beginContent,
  cancelContent,
  contentSnapshot,
  finishContent,
  requestOptionalMods,
  selectOptionalMods,
} from "@/lib/content/state";
import { mergeContentProgress } from "@/utils/content-progress";
import { unpackPack } from "@/lib/content/packs";

vi.mock("extract-zip", () => ({
  default: async (_archive: string, options: { dir: string }) => {
    await mkdir(path.join(options.dir, "overrides", "mods"), {
      recursive: true,
    });
    await writeFile(
      path.join(options.dir, "overrides", "mods", "optional.jar.disabled"),
      "optional bytes",
    );
    await writeFile(
      path.join(options.dir, "modrinth.index.json"),
      JSON.stringify({
        formatVersion: 1,
        game: "minecraft",
        name: "Fixture",
        dependencies: { minecraft: "1.20.1", forge: "47.4.28" },
        files: [],
      }),
    );
  },
}));
afterEach(() => {
  cancelContent();
  finishContent();
});

it("waits for an explicit selection, rejects unlisted IDs and stale responses", async () => {
  const signal = beginContent();
  const pending = requestOptionalMods(
    [{ id: "optional-a", name: "a.jar" }],
    signal,
  );
  const request = contentSnapshot().optionalMods!;
  expect(() =>
    selectOptionalMods(request.requestId, ["untrusted-path"]),
  ).toThrow("không hợp lệ");
  selectOptionalMods(request.requestId, []);
  expect(await pending).toEqual([]);
  expect(contentSnapshot().optionalMods).toBeUndefined();
  expect(() => selectOptionalMods(request.requestId, [])).toThrow("hết hạn");
});

it("cancels while waiting for optional mod choices", async () => {
  const signal = beginContent();
  const pending = requestOptionalMods([{ id: "a", name: "a.jar" }], signal);
  const rejected = expect(pending).rejects.toThrow("hủy");
  cancelContent();
  await rejected;
  expect(contentSnapshot().optionalMods).toBeUndefined();
});

it.each([false, true])(
  "keeps bundled mods disabled unless selected (%s)",
  async (enable) => {
    const directory = await mkdtemp(
      path.join(tmpdir(), "gorth-optional-pack-"),
    );
    try {
      const archive = path.join(directory, "pack.zip");
      await writeFile(archive, "fixture");
      const choose = vi.fn(async (items: { id: string; name: string }[]) => {
        expect(items).toEqual([
          {
            id: "override:mods/optional.jar.disabled",
            name: "mods/optional.jar",
          },
        ]);
        return enable ? items.map((item) => item.id) : [];
      });
      await unpackPack(
        archive,
        directory,
        new AbortController().signal,
        () => {},
        undefined,
        choose,
      );
      const mods = path.join(directory, "payload", "game", "mods");
      expect(
        await readFile(
          path.join(mods, enable ? "optional.jar" : "optional.jar.disabled"),
          "utf8",
        ),
      ).toBe("optional bytes");
      await expect(
        readFile(
          path.join(mods, enable ? "optional.jar.disabled" : "optional.jar"),
        ),
      ).rejects.toThrow();
      expect(choose).toHaveBeenCalledTimes(1);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);

it("builds live console logs even when a status event contains only progress", () => {
  const first = mergeContentProgress(
    { busy: false, message: "old", completed: 0, total: 0, logs: ["old"] },
    { busy: true, message: "Downloading a.jar", completed: 1, total: 2 },
  );
  const second = mergeContentProgress(first, {
    busy: true,
    message: "Downloading b.jar",
    completed: 2,
    total: 2,
  });
  expect(second.logs).toEqual([
    "Downloading a.jar (1/2)",
    "Downloading b.jar (2/2)",
  ]);
  expect(
    mergeContentProgress(second, { ...second, logs: ["Main process log"] })
      .logs,
  ).toEqual(["Main process log"]);
});
