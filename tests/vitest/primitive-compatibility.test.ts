import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(import.meta.url);
function imports(filename: string, source: string) {
  const ast = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const values: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (
        (ts.isExportDeclaration(node) && node.isTypeOnly) ||
        (ts.isImportDeclaration(node) && node.importClause?.isTypeOnly)
      )
        return;
      if (
        ts.isImportDeclaration(node) &&
        node.importClause &&
        !node.importClause.name &&
        node.importClause.namedBindings &&
        ts.isNamedImports(node.importClause.namedBindings) &&
        node.importClause.namedBindings.elements.every(
          (item) => item.isTypeOnly,
        )
      )
        return;
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier))
        values.push(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    )
      values.push(node.arguments[0].text);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return values;
}
async function applicationFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) return applicationFiles(filename);
      return /\.[cm]?[jt]sx?$/.test(filename) && !filename.endsWith(".d.ts")
        ? [filename]
        : [];
    }),
  );
  return nested.flat();
}
it("keeps every app-owned Primitive runtime import free of Next dependencies, including unused exports in dev", async () => {
  const files = (
    await Promise.all(
      [
        "app",
        "components",
        "hooks",
        "layouts",
        "pages",
        "providers",
        "utils",
        "lib",
      ].map((dir) => applicationFiles(path.join(root, dir))),
    )
  ).flat();
  const publicImports = new Set<string>();
  for (const filename of files) {
    for (const value of imports(filename, await readFile(filename, "utf8"))) {
      if (value.startsWith("@gorth-io/primitive/") && !value.endsWith(".css"))
        publicImports.add(value);
    }
  }
  const parsed = new Map<string, string[]>();
  const incompatible: string[] = [];
  async function inspect(
    filename: string,
    entry: string,
    visited: Set<string>,
  ) {
    if (visited.has(filename) || filename.endsWith(".css")) return;
    visited.add(filename);
    let dependencies = parsed.get(filename);
    if (!dependencies) {
      dependencies = imports(filename, await readFile(filename, "utf8"));
      parsed.set(filename, dependencies);
    }
    for (const dependency of dependencies) {
      if (/^(next($|\/)|@next\/|@bprogress\/next)/.test(dependency)) {
        incompatible.push(
          entry + " -> " + path.basename(filename) + " -> " + dependency,
        );
      } else if (dependency.startsWith(".")) {
        await inspect(
          path.resolve(path.dirname(filename), dependency),
          entry,
          visited,
        );
      } else if (dependency.startsWith("@gorth-io/primitive/")) {
        await inspect(require.resolve(dependency), entry, visited);
      }
    }
  }
  for (const entry of publicImports)
    await inspect(require.resolve(entry), entry, new Set());
  expect(publicImports.size).toBeGreaterThan(10);
  expect(incompatible).toEqual([]);
});
