import type { ForgeConfig } from "@electron-forge/shared-types";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadDevelopmentEnvironment } from "./utils/development-environment";
import { getMacReleaseSigning } from "./utils/release-environment";
import { trackDevelopmentProcess } from "./main/services/forge-lifecycle";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { FuseV1Options, FuseVersion } from "@electron/fuses";

const appIcon =
  process.platform === "darwin"
    ? "public/favicon.icns"
    : process.platform === "win32"
      ? "public/favicon.ico"
      : "public/favicon.png";

const config: ForgeConfig = {
  hooks: {
    postStart: async (_config, appProcess) => {
      trackDevelopmentProcess(appProcess);
    },
    preStart: async () => {
      loadDevelopmentEnvironment(fileURLToPath(new URL(".", import.meta.url)));
      // Set before Electron is spawned; AppKit logging initializes before main.ts.
      if (process.platform === "darwin") {
        process.env.OS_ACTIVITY_MODE ??= "disable";
      }
    },
  },
  packagerConfig: {
    ...getMacReleaseSigning(),
    // Packager clears its temp root; never share it with another Forge process.
    tmpdir: join(tmpdir(), `gorth-launcher-forge-${process.pid}`),
    appBundleId: "com.gorth.launcher",
    appCategoryType: "public.app-category.games",
    asar: { unpack: "**/*.node" },
    protocols: [
      { name: "Gorth authentication", schemes: ["com.gorth.launcher"] },
    ],
    executableName: "Gorth Launcher",
    icon: appIcon,
    // Vite bundles JS, but better-sqlite3 remains external and icons load at runtime.
    ignore: (filePath) => {
      if (!filePath) return false;
      return !(
        filePath.startsWith("/.vite") ||
        filePath === "/public" ||
        filePath.startsWith("/public/") ||
        filePath === "/node_modules" ||
        filePath.startsWith("/node_modules/")
      );
    },
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel((arch) => ({
      name: "gorth_launcher",
      setupExe: `gorth-launcher-win32-${arch}-setup.exe`,
      setupMsi: `gorth-launcher-win32-${arch}-setup.msi`,
      noMsi: false,
    })),
    {
      name: "@electron-forge/maker-dmg",
      platforms: ["darwin"],
      config: { format: "ULFO" },
    },
    new MakerZIP({}, ["darwin"]),
    new MakerRpm({
      options: { name: "gorth-launcher", productName: "Gorth Launcher" },
    }),
    new MakerDeb({
      options: { name: "gorth-launcher", productName: "Gorth Launcher" },
    }),
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: "app/main.ts",
          config: "rollup.config.ts",
          target: "main",
        },
        {
          entry: "app/preload.ts",
          config: "rolldown.config.ts",
          target: "preload",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.config.ts",
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
