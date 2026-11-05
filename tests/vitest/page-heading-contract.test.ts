import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { expect, it } from "vitest";

it("gives every page heading its own icon without passing descriptions", () => {
  const root = fileURLToPath(new URL("../../pages", import.meta.url));
  const issues: string[] = [];
  function scan(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        scan(file);
        continue;
      }
      if (
        !file.endsWith(".tsx") ||
        file === path.join(root, "shared", "index.tsx")
      )
        continue;
      const source = ts.createSourceFile(
        file,
        readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      function visit(node: ts.Node) {
        if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
          const tag = node.tagName.getText(source);
          if (tag === "PageHeading") {
            const names = node.attributes.properties
              .filter(ts.isJsxAttribute)
              .map((attr) => attr.name.getText(source));
            if (!names.includes("icon") || names.includes("description"))
              issues.push(path.relative(root, file) + ": " + tag);
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
  scan(root);
  expect(issues).toEqual([]);
});
