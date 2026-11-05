import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory()
      ? files(filename)
      : filename.endsWith(".tsx")
        ? [filename]
        : [];
  });
}
it("does not render inline error alerts or raw error bindings in launcher screens", () => {
  const root = new URL("../../", import.meta.url);
  for (const directory of ["pages", "components", "layouts", "app"]) {
    for (const file of files(new URL(directory, root).pathname)) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/role="alert"/);
      expect(source, file).not.toMatch(
        />\s*\{(?:error|auth\.error|library\.error|status\.error)\}\s*</,
      );
    }
  }
});
it("uses the existing portal-backed toast manager and stable IDs for error feedback", () => {
  const source = readFileSync(
    new URL("../../hooks/use-feedback-toast.ts", import.meta.url),
    "utf8",
  );
  expect(source).toContain('from "@/providers/toaster"');
  expect(source).toContain("useId()");
  expect(source).toContain("[id, message, type]");
});
