import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import {
  javaPreferencesSchema,
  minecraftPreferencesSchema,
  javaPreferences,
  presetArguments,
  effectiveGameSettings,
} from "@/lib/library/game-preferences";
import { defaultInstanceSettings } from "@/lib/library/instance-settings";
import { settingsSchema } from "@/lib/library/settings-schema";
import { createLibraryStore } from "@/services/library-store";
import { formatPlayTime } from "@/utils/formatter";
it("validates Java options and MiB memory without passing obsolete PermGen flags", () => {
  const value = javaPreferencesSchema.parse({
    memoryMinMiB: 1536,
    memoryMaxMiB: 8192,
    optimizedDefaults: true,
    garbageCollector: "zgc",
    customArguments: [" -Dfixture=true ", ""],
  });
  expect(value.customArguments).toEqual(["-Dfixture=true"]);
  expect(presetArguments(value)).toContain("-XX:+UseZGC");
  expect(presetArguments(value)).not.toContain("-XX:+UseG1GC");
  expect(presetArguments(value).join(" ")).not.toContain("Perm");
  expect(
    javaPreferencesSchema.safeParse({ memoryMinMiB: 4096, memoryMaxMiB: 1024 })
      .success,
  ).toBe(false);
  expect(javaPreferences({ memory: 6, javaPath: "" }).memoryMaxMiB).toBe(6144);
  expect(
    javaPreferencesSchema.safeParse({ customArguments: ["bad\0argument"] })
      .success,
  ).toBe(false);
});
it("applies global defaults without replacing instance overrides or account bindings", () => {
  const global = settingsSchema.parse({
    memory: 4,
    javaPath: "/java",
    java: { memoryMinMiB: 1536, memoryMaxMiB: 6144 },
    minecraft: {
      windowWidth: 1600,
      windowHeight: 900,
      preLaunchCommand: "/global/start",
      environment: { SHARED: "global", GLOBAL: "yes" },
      gpuPreference: "high-performance",
    },
  });
  const defaults = defaultInstanceSettings(global);
  expect(defaults).toMatchObject({
    memoryMin: 1.5,
    memoryMax: 6,
    resolutionWidth: 1600,
    resolutionHeight: 900,
    gpuPreference: "high-performance",
    preLaunchCommand: "/global/start",
  });
  const instance = {
    ...defaults,
    overrides: undefined, // Legacy records predate explicit inheritance switches.
    memoryMax: 3,
    accountId: "gorth:fixture",
    environment: { SHARED: "instance" },
    preLaunchCommand: "/instance/start",
  };
  expect(effectiveGameSettings(global, instance)).toMatchObject({
    memoryMax: 3,
    accountId: "gorth:fixture",
    preLaunchCommand: "/instance/start",
    environment: { SHARED: "instance", GLOBAL: "yes" },
    javaOptions: { memoryMinMiB: 1536 },
  });
  expect(instance.environment).toEqual({ SHARED: "instance" });
  expect(
    effectiveGameSettings(global, { ...instance, preLaunchCommand: "" })
      .preLaunchCommand,
  ).toBe("");
});
it("validates Minecraft policies and formats durations", () => {
  const value = minecraftPreferencesSchema.parse({
    hideLauncher: true,
    quitLauncher: true,
    recordGameTime: false,
    elyPatch: "eligible",
    consoleOnLaunch: true,
    consoleOnCrash: true,
    hideConsoleOnExit: true,
    durationsInHours: true,
  });
  expect(value).toMatchObject({
    hideLauncher: true,
    quitLauncher: true,
    recordGameTime: false,
    consoleOnLaunch: true,
  });
  expect(
    minecraftPreferencesSchema.safeParse({
      environment: { "INVALID-KEY": "x" },
    }).success,
  ).toBe(false);
  expect(
    minecraftPreferencesSchema.safeParse({ windowHeight: 1 }).success,
  ).toBe(false);
  expect(
    minecraftPreferencesSchema.safeParse({ preLaunchCommand: "\0" }).success,
  ).toBe(false);
  expect(formatPlayTime(90 * 60000, true)).toBe("1.5 h");
});
it("persists Java/Minecraft defaults and preserves per-instance settings", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "gorth-game-preferences-"),
  );
  let store: Awaited<ReturnType<typeof createLibraryStore>> | undefined;
  try {
    store = await createLibraryStore(directory, () => false);
    await store.command({
      action: "create",
      name: "Fixture",
      version: "1.20.1",
      loader: "Vanilla",
    });
    const id = store.snapshot().instances[0].id;
    await store.command({
      action: "instance.settings",
      id,
      settings: {
        ...store.snapshot().instanceSettings[id],
        memoryMax: 2,
        javaPath: "/instance/java",
      },
    });
    await store.command({
      action: "settings",
      settings: {
        ...store.snapshot().settings,
        java: javaPreferencesSchema.parse({
          memoryMaxMiB: 6144,
          skipSetupPrompt: true,
        }),
        minecraft: minecraftPreferencesSchema.parse({
          consoleOnLaunch: true,
          recordGameTime: false,
        }),
      },
    });
    store.close();
    store = await createLibraryStore(directory, () => false);
    expect(store.snapshot().settings).toMatchObject({
      java: { memoryMaxMiB: 6144, skipSetupPrompt: true },
      minecraft: { consoleOnLaunch: true, recordGameTime: false },
    });
    expect(store.snapshot().instanceSettings[id]).toMatchObject({
      memoryMax: 2,
      javaPath: "/instance/java",
    });
  } finally {
    store?.close();
    await rm(directory, { recursive: true, force: true });
  }
});
