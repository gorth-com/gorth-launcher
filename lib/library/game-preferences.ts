import { z } from "@gorth-io/structure/cores/zod";
import type { Settings, InstanceSettings } from "@/utils/interface";

const argument = z
  .string()
  .max(4096)
  .refine((value) => !value.includes("\0"));
export const javaPreferencesSchema = z
  .object({
    skipCompatibilityChecks: z.boolean().default(false),
    skipSetupPrompt: z.boolean().default(false),
    autoDetect: z.boolean().default(true),
    autoDownloadMojang: z.boolean().default(false),
    memoryMinMiB: z.number().int().min(128).max(65536).default(1024),
    memoryMaxMiB: z.number().int().min(128).max(65536).default(4096),
    permGenMiB: z.number().int().min(0).max(4096).default(128),
    warnFreeMemory: z.boolean().default(true),
    optimizedDefaults: z.boolean().default(false),
    garbageCollector: z
      .enum(["none", "g1", "shenandoah", "zgc"])
      .default("none"),
    customArguments: z
      .array(argument)
      .max(128)
      .default([])
      .transform((values) =>
        values.map((value) => value.trim()).filter(Boolean),
      ),
  })
  .refine(
    (value) => value.memoryMinMiB <= value.memoryMaxMiB,
    "Minimum memory must not exceed maximum memory.",
  );
export const minecraftPreferencesSchema = z.object({
  elyPatch: z.enum(["never", "eligible", "always"]).default("never"),
  maximized: z.boolean().default(false),
  windowWidth: z.number().int().min(320).max(16384).default(1280),
  windowHeight: z.number().int().min(240).max(16384).default(720),
  hideLauncher: z.boolean().default(false),
  quitLauncher: z.boolean().default(false),
  consoleOnLaunch: z.boolean().default(false),
  consoleOnCrash: z.boolean().default(true),
  hideConsoleOnExit: z.boolean().default(false),
  showGameTime: z.boolean().default(true),
  recordGameTime: z.boolean().default(true),
  showTotalTime: z.boolean().default(true),
  durationsInHours: z.boolean().default(false),
  preLaunchCommand: argument.default(""),
  postExitCommand: argument.default(""),
  environment: z
    .record(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/), argument)
    .refine((value) => Object.keys(value).length <= 64)
    .default({}),
  gpuPreference: z
    .enum(["default", "high-performance", "integrated"])
    .default("default"),
  openGlPath: argument.default(""),
  openAlPath: argument.default(""),
  glfwPath: argument.default(""),
});
export type JavaPreferences = z.infer<typeof javaPreferencesSchema>;
export type MinecraftPreferences = z.infer<typeof minecraftPreferencesSchema>;
export interface JavaInstallation {
  path: string;
  version: string;
  major: number;
  vendor: string;
  architecture: string;
}
export function javaPreferences(settings: Settings): JavaPreferences {
  return javaPreferencesSchema.parse(
    settings.java ?? { memoryMaxMiB: settings.memory * 1024 },
  );
}
export function minecraftPreferences(settings: Settings): MinecraftPreferences {
  return minecraftPreferencesSchema.parse(settings.minecraft ?? {});
}
export function presetArguments(preferences: JavaPreferences): string[] {
  return [
    ...(preferences.optimizedDefaults && preferences.garbageCollector === "none" ? ["-XX:+UseG1GC"] : []),
    ...(preferences.optimizedDefaults
      ? [
          "-XX:+UnlockExperimentalVMOptions",
          "-XX:G1NewSizePercent=20",
          "-XX:G1ReservePercent=20",
          "-XX:MaxGCPauseMillis=50",
          "-XX:G1HeapRegionSize=32M",
        ]
      : []),
    ...{
      none: [],
      g1: ["-XX:+UseG1GC"],
      shenandoah: ["-XX:+UseShenandoahGC"],
      zgc: ["-XX:+UseZGC"],
    }[preferences.garbageCollector],
    ...preferences.customArguments,
  ];
}
export function effectiveGameSettings(
  settings: Settings,
  instance: InstanceSettings,
): InstanceSettings {
  const minecraft = minecraftPreferences(settings);
  return {
    ...instance,
    javaOptions: javaPreferences(settings),
    minecraftOptions: minecraft,
    environment: { ...minecraft.environment, ...instance.environment },
  };
}
