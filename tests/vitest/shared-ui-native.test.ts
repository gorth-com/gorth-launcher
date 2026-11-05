import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { build as bundle } from "esbuild";
import {
  build,
  createServer,
  type InlineConfig,
  type ViteDevServer,
} from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { expect, it } from "vitest";

it.each(["production", "development"])(
  "renders the desktop sidebar and native account portal in %s",
  async (mode) => {
    if (
      process.platform === "darwin" &&
      process.env.CODEX_SANDBOX === "seatbelt"
    )
      throw new Error(
        "Electron UI tests need GUI permission outside the sandbox",
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
      await mkdtemp(path.join(tmpdir(), "gorth-shared-ui-")),
    );
    let server: ViteDevServer | undefined;
    let rendererUrl: string | undefined;
    try {
      await mkdir(path.join(directory, "profile"));
      const config: InlineConfig = {
        configFile: false as const,
        envDir: false as const,
        base: "./",
        logLevel: "error",
        root: path.join(root, "tests/fixtures/shared-ui"),
        cacheDir: path.join(directory, "vite-cache"),
        plugins: [react(), tailwind()],
        resolve: { alias: { "@": root } },
        build: { outDir: path.join(directory, "renderer"), emptyOutDir: false },
      };
      if (mode === "production") await build(config);
      else {
        server = await createServer({
          ...config,
          server: { host: "127.0.0.1", port: 0 },
        });
        await server.listen();
        rendererUrl = server.resolvedUrls?.local[0];
        if (!rendererUrl)
          throw new Error("The isolated Vite server did not start.");
      }
      await bundle({
        absWorkingDir: root,
        entryPoints: ["tests/fixtures/shared-ui/main.ts"],
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
        [
          path.join(directory, "main.cjs"),
          ...(rendererUrl ? [rendererUrl] : []),
          directory,
        ],
        { cwd: root, env, timeout: 20000, maxBuffer: 512000 },
      );
      const line = stdout
        .split(/\r?\n/)
        .find((value) => value.startsWith("GORTH_SHARED_UI="));
      expect(line, stdout).toBeDefined();
      const { errors, result } = JSON.parse(
        line!.slice("GORTH_SHARED_UI=".length),
      );
      expect(errors, JSON.stringify(result)).toEqual([]);
      expect(result.height).toBe(36);
      expect(result.large).toEqual([56, 56]);
      expect(result.light).not.toBe(result.dark);
      expect(result.brandFont).toBe("24px");
      expect(result.headingIcon).toEqual([36, 36, 16, 16]);
      expect(result.confirmations).toEqual([
        "confirm:false",
        "confirm:true",
        "confirm:false",
      ]);
      expect(result.iconWidth).toBe(36);
      expect(result.footer).toBe(true);
      expect(result.navigation).toBe(true);
      expect(result.stayedInRenderer).toBe(true);
      expect(result.portalSeparate).toBe(true);
      expect(result.accountNavigation).toBe(true);
      expect(result.escaped).toBe(true);
      expect(result.logout).toBe(true);
      expect(result.guestActions).toEqual(["login", "register"]);
      expect(result.collapsed.width).toBe(56);
      expect(result.collapsed.buttons.length).toBeGreaterThan(2);
      for (const button of result.collapsed.buttons) {
        expect(button.width).toBe(36);
        expect(button.height).toBe(36);
        expect(button.labelHidden).toBe(true);
      }
      expect(result.collapsed.buttons.at(-1).avatar).toBe(true);
      expect(result.settingsFullWindow).toBe(true);
      expect(result.settingsSidebar).toBe(true);
      expect(result.settingsNavigation).toBe(true);
      expect(result.appearance).toBe(true);
      expect(result.layoutRadio).toBe(true);
      expect(result.runtimeControls).toBe(true);
      expect(result.javaSaved).toBe(true);
      expect(result.permGenDisabled).toBe(true);
      expect(result.minecraftSaved).toBe(true);
      expect(result.minecraftTabs).toEqual(["General", "Tweaks", "Custom Commands", "Environment Variables"]);
      expect(result.additionalSettings).toEqual(["General", "Language", "Services", "Tools", "Proxy"]);
      expect(result.proxySystemDisabled).toBe(true);
      expect(result.proxyHttpEnabled).toBe(true);
      expect(result.mainReturn).toBe(true);
      expect(result.createRoute).toBe("/instances/create");
      expect(result.editRoute).toBe("/instances/edit/6f60ed3d-84f9-4dd2-b77a-c3f037d0306e");
      expect(result.dataRoute).toBe("/instances/data");
      expect(result.createState).toBe("Native fixture");
      expect(result.createdInstance).toMatchObject({name:"Native fixture",group:"Friends",iconData:"lucide:star",version:"1.20.1",loader:"Vanilla"});
      expect(result.editData).toBe("6f60ed3d-84f9-4dd2-b77a-c3f037d0306e");
      expect(result.editSectionOnly).toBe(true);
      expect(result.workspaceBack).toBe(true);
      expect(result.dataLoaded).toBe(true);
    } finally {
      await server?.close();
      await rm(directory, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);
