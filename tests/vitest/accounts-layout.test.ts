import { readFileSync } from "node:fs";
import ts from "typescript";
import { expect, it } from "vitest";

it("keeps banner and account cards outside the Offline form and right column", () => {
  const text = readFileSync(
    new URL("../../pages/accounts/index.tsx", import.meta.url),
    "utf8",
  );
  const source = ts.createSourceFile(
    "accounts.tsx",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const misplaced: string[] = [];
  let banners = 0;
  function visit(node: ts.Node, insideForm = false, insideAside = false) {
    if (ts.isJsxAttribute(node) && node.name.getText(source) === "aside")
      insideAside = true;
    if (
      ts.isJsxElement(node) &&
      node.openingElement.tagName.getText(source) === "form"
    )
      insideForm = true;
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source);
      if (tag === "PageBanner") banners++;
      if (
        (insideForm && ["Card", "PageBanner"].includes(tag)) ||
        (insideAside && tag === "PageBanner")
      )
        misplaced.push(tag);
    }
    ts.forEachChild(node, (child) => visit(child, insideForm, insideAside));
  }
  visit(source);
  expect(banners).toBe(1);
  expect(misplaced).toEqual([]);
});
