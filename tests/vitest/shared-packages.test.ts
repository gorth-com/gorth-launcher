import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(import.meta.url);
async function sources(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const results = await Promise.all(
    entries.map(async (entry) => {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) return sources(filename);
      return /\.tsx?$/.test(filename) ? [await readFile(filename, "utf8")] : [];
    }),
  );
  return results.flat();
}

describe("published Gorth package integration", () => {
  it("resolves public runtime exports without application re-export wrappers", () => {
    for (const name of [
      "@gorth-io/primitive/custom/button",
      "@gorth-io/primitive/custom/sidebar",
      "@gorth-io/primitive/custom/toast",
      "@gorth-io/primitive/custom/dropdown",
      "@gorth-io/primitive/default/input",
      "@gorth-io/primitive/default/tooltip",
      "@gorth-io/primitive/cores/cn",
      "@gorth-io/primitive/cores/tanstack/query",
      "@gorth-io/primitive/globals.css",
      "@gorth-io/principle/cores/jose",
      "@gorth-io/structure/cores/axios",
      "@gorth-io/structure/cores/zod",
      "@gorth-io/structure/modules/auth/client",
      "@gorth-io/structure/modules/desktop",
    ])
      expect(existsSync(require.resolve(name)), name).toBe(true);
  });
  it("removes duplicate UI and cn files", () => {
    expect(existsSync(path.join(root, "components/ui/button.tsx"))).toBe(false);
    expect(existsSync(path.join(root, "utils.ts"))).toBe(false);
  });
  it("uses the application CSS entry without duplicating the shared theme", async () => {
    const css = await readFile(path.join(root, "styles/globals.css"), "utf8");
    expect(css).toContain('@import "tailwindcss";');
    expect(css).toContain('@import "@gorth-io/primitive/globals.css";');
    expect(css).toContain('@import "./internals.css";');
    expect(css).toContain('@source "../components";');
    expect(css).not.toContain("--background:");
    expect(css).not.toContain("--foreground:");
    const renderer = await readFile(
      path.join(root, "app/renderer.tsx"),
      "utf8",
    );
    expect(renderer).toContain('import "@/styles/globals.css";');
    expect(renderer).not.toContain("virtual:gorth-styles");
    const config = JSON.parse(
      await readFile(path.join(root, "components.json"), "utf8"),
    );
    expect(config.tailwind.css).toBe("styles/globals.css");
  });
  it("prefers custom components and contains no stale local UI imports", async () => {
    const text = (
      await Promise.all(
        [
          "app",
          "components",
          "layouts",
          "pages",
          "providers",
          "lib",
          "utils",
          "services",
          "main",
          "preload",
        ].map((directory) => sources(path.join(root, directory))),
      )
    )
      .flat()
      .join("\n");
    expect(text).not.toContain("@/components/ui/");
    expect(text).not.toContain("@gorth-io/structure/cores/auth");
    expect(text).not.toContain("@gorth-io/structure/modules/auth/desktop");
    expect(text).not.toContain('@/utils"');
    expect(text).not.toContain(["@/lib", "utils"].join("/"));
    for (const name of [
      "button",
      "avatar",
      "badge",
      "sidebar",
      "sheet",
      "collapsible",
      "tabs",
      "toast",
    ])
      expect(text).not.toContain(`@gorth-io/primitive/default/${name}"`);
  });
  it("keeps only owning packages and required Electron/database/peer dependencies", async () => {
    const manifest = JSON.parse(
      await readFile(path.join(root, "package.json"), "utf8"),
    );
    for (const name of ["primitive", "principle", "structure"])
      expect(manifest.dependencies[`@gorth-io/${name}`]).toContain(
        "github:gorth-io/",
      );
    for (const name of [
      "axios",
      "zod",
      "cn",
      "jose",
      "@base-ui/react",
      "lucide-react",
      "@hono/node-server",
    ])
      expect(manifest.dependencies[name], name).toBeUndefined();
    for (const name of [
      "react",
      "react-dom",
      "nitro",
      "better-sqlite3",
      "drizzle-orm",
      "@trpc/server",
      "@trpc/client",
      "@trpc/tanstack-react-query",
      "better-auth",
      "@better-auth/electron",
    ])
      expect(manifest.dependencies[name], name).toBeTruthy();
    for (const name of ["@tailwindcss/postcss", "@tailwindcss/typography"])
      expect(manifest.devDependencies[name], name).toBeUndefined();
  });
});
