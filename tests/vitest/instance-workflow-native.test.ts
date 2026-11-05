import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { build as bundle } from "esbuild";
import { build } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { expect, it } from "vitest";

it("keeps instance context across tools and renders shipped JetBrains Mono code blocks in Electron", async () => {
  if (process.platform === "darwin" && process.env.CODEX_SANDBOX === "seatbelt")
    throw new Error(
      "Electron workflow verification requires GUI permission outside the sandbox",
    );
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const require = createRequire(import.meta.url);
  const electronRoot = path.dirname(require.resolve("electron/package.json"));
  const executable = path.join(
    electronRoot,
    "dist",
    (await readFile(path.join(electronRoot, "path.txt"), "utf8")).trim(),
  );
  const directory = await realpath(
    await mkdtemp(path.join(tmpdir(), "gorth-instance-workflow-")),
  );
  try {
    await mkdir(path.join(directory, "profile"));
    await build({
      configFile: false,
      envDir: false,
      base: "./",
      logLevel: "error",
      root: path.join(root, "tests/fixtures/instance-workflow"),
      cacheDir: path.join(directory, "cache"),
      plugins: [react(), tailwind()],
      resolve: { alias: { "@": root } },
      build: { outDir: path.join(directory, "renderer"), emptyOutDir: false },
    });
    await bundle({
      absWorkingDir: root,
      entryPoints: ["tests/fixtures/instance-workflow/main.ts"],
      bundle: true,
      platform: "node",
      format: "cjs",
      external: ["electron"],
      outfile: path.join(directory, "main.cjs"),
    });
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.NODE_OPTIONS;
    const { stdout } = await promisify(execFile)(
      executable,
      [path.join(directory, "main.cjs"), directory],
      { cwd: root, env, timeout: 40000, maxBuffer: 512000 },
    );
    const line = stdout
      .split(/\r?\n/)
      .find((value) => value.startsWith("GORTH_INSTANCE_WORKFLOW="));
    expect(line, stdout).toBeDefined();
    const { result, errors } = JSON.parse(
      line!.slice("GORTH_INSTANCE_WORKFLOW=".length),
    );
    expect(errors, JSON.stringify(result)).toEqual([]);
    expect(result.badges).toEqual([
      { text: "2", width: 24, height: 24 },
      { text: "3", width: 24, height: 24 },
    ]);
    expect(result.home).toEqual({ oldPanels: false, recent: true, selects: 2 });
    expect(result.removedNavigation).toBe(true);
    expect(result.noOtherGameLog).toBe(true);
    expect(result.instances).toEqual({
      cards: 2,
      aside: false,
      oldSelector: false,
    });
    expect(result.instanceToolbar, stdout).toEqual({
      order: true,
      selectWidth: 180,
      gap: "8px",
      sectionGap: "24px",
      iconInside: true,
      countInside: true,
      actionsInHeading: true,
    });
    expect(result.instanceList).toBe(true);
    expect(result.instanceHorizontal).toBe(true);
    expect(result.instanceSearch).toBe(1);
    expect(result.instancePlay).toBe(true);
    expect(result.instanceDetailIcon).toBe(true);
    expect(result.log).toMatchObject({
      weight: "600",
      size: "13px",
      loaded: true,
      literal: true,
      unsafe: false,
      selector: false,
    });
    expect(result.log.family).toContain("JetBrains Mono");
    expect(result.editorContentSelector).toBe(false);
    expect(result.contentHasManager).toBe(false);
    expect(result.search).toMatchObject({
      kind: "mod",
      version: "1.21.1",
      loader: "Fabric",
    });
    expect(result.screenshots).toBe(true);
    expect(result.dataSelector).toBe(false);
    expect(result.archiveFont).toBe("13px");
    expect(result.downloads).toEqual({
      pre: false,
      history: false,
      progress: true,
    });
    expect(result.downloadConsole).toBe(true);
    expect(result.history).toBe(true);
    expect(result.packTabs).toEqual([
      "Mods",
      "Resource Packs",
      "Shader Packs",
      "Data Packs",
      "Worlds",
    ]);
    expect(result.packDefaults).toEqual({ provider: true, browse: true });
    expect(result.packFiltersRight).toBe(true);
    expect(result.packToolbar).toEqual({
      searchRight: true,
      searchIcon: true,
      noLabel: true,
      headingRight: true,
      card: true,
      equalColumns: true,
      searchWithinRight: true,
      equalTabWidths: true,
      searchIconOnly: true,
      sortWidth: 180,
      countWidth: 60,
      controlsJustify: "space-between",
      pagingBeforeLayout: true,
    });
    expect(result.packSearchKinds).toEqual(
      expect.arrayContaining(["resourcepack", "shader"]),
    );
    expect(result.deletedFallback).toBe(true);
  } finally {
    await rm(directory, { recursive: true, force: true, maxRetries: 3 });
  }
}, 90000);
