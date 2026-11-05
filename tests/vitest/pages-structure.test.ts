import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

it("keeps every pages source file in a directory named index.tsx", () => {
  const root = fileURLToPath(new URL("../../pages/", import.meta.url));
  function sources(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const file = path.join(directory, entry.name);
      return entry.isDirectory()
        ? sources(file)
        : /\.[cm]?[jt]sx?$/.test(entry.name)
          ? [file]
          : [];
    });
  }
  const files = sources(root);
  expect(files.length).toBeGreaterThan(0);
  expect(
    files
      .filter((file) => path.basename(file) !== "index.tsx")
      .map((file) => path.relative(root, file)),
  ).toEqual([]);
});
