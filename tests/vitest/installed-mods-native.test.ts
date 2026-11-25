import { execFile } from "node:child_process";
import { mkdtemp, mkdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { build as bundle } from "esbuild";
import { build } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { expect, it } from "vitest";
import { getElectronExecutable } from "../helpers/electron";

it.each(["--installed-mods", "--logs", "--page-cards"])(
  "renders instance tools (%s)",
  async (flag) => {
    const root = fileURLToPath(new URL("../../", import.meta.url));
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
        getElectronExecutable(),
        [path.join(directory, "main.cjs"), flag, directory],
        { cwd: root, env, timeout: 25000, maxBuffer: 512000 },
      );
      const line = stdout
        .split(/\r?\n/)
        .find((value) => value.startsWith("GORTH_INSTANCE_WORKFLOW="));
      expect(line, stdout).toBeDefined();
      const { errors, result } = JSON.parse(
        line!.slice("GORTH_INSTANCE_WORKFLOW=".length),
      );
      expect(errors).toEqual([]);
      if (flag === "--page-cards") {
        expect(result.downloadCards).toMatchObject({
          columns: 3,
          padding: "16px",
          directoryCard: true,
          below: true,
          topRight: true,
        });
        expect(result.downloadCards.ratio).toBeGreaterThan(1.8);
        expect(result.downloadCards.ratio).toBeLessThan(2.2);
        expect(result.notificationCards).toMatchObject({
          columns: 3,
          padding: "16px",
          title: true,
          badges: true,
          heading: true,
          unread: true,
          removed: true,
        });
        expect(result.consolePicker).toBe(true);
        expect(result.searchSpinner).toBe(true);
        expect(result.completionToast).toBe(true);
        return;
      }
      if (flag === "--logs") {
        expect(result.consoleLayout).toMatchObject({
          toolbar: 36,
          fills: true,
          tall: true,
          scrollArea: true,
          destructive: true,
          text: true,
        });
        expect(result.consoleExport).toBe(true);
        expect(result.otherLogs).toMatchObject({
          gzip: true,
          literal: true,
          scrollArea: true,
          export: true,
          fits: true,
        });
        expect(result.otherLogs.height).toBeGreaterThan(400);
        expect(result.consoleHeading).toBe(true);
        expect(result.otherLogsFind).toBe(true);
        expect(result.otherLogsBottom).toBe(true);
        return;
      }
      expect(result.modpackOverview).toEqual({
        info: true,
        actions: 2,
        changelog: true,
      });
      expect(result.runtimeComponents).toMatchObject({
        table: true,
        minecraft: true,
        padding: "16px",
        gap: "16px",
      });
      expect(result.runtimeComponents.ratio).toBeGreaterThan(1.8);
      expect(result.runtimeComponents.ratio).toBeLessThan(2.2);
      expect(result.installedMods).toMatchObject({
        columns: 3,
        online: true,
        checked: "true",
        footerJustify: "space-between",
        search: true,
        searchOutside: true,
        padding: "16px",
        gap: "16px",
        toggled: true,
      });
      expect(result.installedMods.ratio).toBeGreaterThan(1.8);
      expect(result.installedMods.ratio).toBeLessThan(2.2);
    } finally {
      await rm(directory, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);
