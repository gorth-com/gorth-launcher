import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { expect, it } from "vitest";
import {
  instanceSettingsSchema,
  defaultInstanceSettings,
} from "@/lib/library/instance-settings";
import { instanceOverrides } from "@/lib/library/instance-overrides";
import {
  effectiveGameSettings,
  javaPreferences,
  minecraftPreferences,
  presetArguments,
} from "@/lib/library/game-preferences";
import { createLibraryStore } from "@/services/library-store";
import { launchArguments } from "@/lib/game/install";
import { launchProcess } from "@/lib/game/launch-process";
import type { Settings, Version } from "@/utils/interface";

const global: Settings = {
  memory: 4,
  javaPath: "/default/java",
  javaPaths: { "21": "/21/java" },
  java: javaPreferences({ memory: 4, javaPath: "" }),
  minecraft: minecraftPreferences({
    memory: 4,
    javaPath: "",
    minecraft: {
      ...minecraftPreferences({ memory: 4, javaPath: "" }),
      environment: { GLOBAL: "yes", SHARED: "global" },
      preLaunchCommand: "/global/start",
      consoleOnLaunch: true,
      glfwPath: "/global/glfw",
      recordGameTime: true,
    },
  }),
};

it("new instances inherit live global changes while disabled values remain dormant", () => {
  const stored = defaultInstanceSettings(global);
  stored.memoryMax = 2;
  stored.javaPath = "/custom/java";
  stored.joinServer = "private.test";
  stored.accountId = "some-account";
  stored.preLaunchCommand = "/custom/start";
  stored.wrapperCommand = "/custom/wrapper";
  stored.environment = { SHARED: "custom" };
  const changed = {
    ...global,
    java: { ...global.java!, memoryMaxMiB: 8192 },
    minecraft: { ...global.minecraft!, windowWidth: 1920 },
  };
  const result = effectiveGameSettings(changed, stored);
  expect(result).toMatchObject({
    memoryMax: 8,
    javaPath: "",
    javaPaths: { default: "/default/java", "21": "/21/java" },
    resolutionWidth: 1920,
    accountId: null,
    joinServer: "",
    preLaunchCommand: "/global/start",
    wrapperCommand: "",
    environment: global.minecraft!.environment,
  });
  expect(stored.memoryMax).toBe(2);
  expect(stored.environment).toEqual({ SHARED: "custom" });
});

it("overrides each runtime group independently and allows clearing inherited commands/environment/native paths", () => {
  const stored = defaultInstanceSettings(global);
  stored.overrides = Object.fromEntries(
    Object.keys(stored.overrides!).map((key) => [key, true]),
  ) as NonNullable<typeof stored.overrides>;
  Object.assign(stored, {
    memoryMin: 2,
    memoryMax: 8,
    javaPath: "/custom/java",
    fullscreen: true,
    resolutionWidth: 1600,
    accountId: "offline:test",
    joinWorld: "World 1",
    environment: {},
    preLaunchCommand: "",
    wrapperCommand: "/wrapper",
    jvmArguments: ["-Dcustom=yes"],
    glfwPath: "/unused/glfw",
    nativeLibraries: { glfw: false, openAl: false, openGl: false },
  });
  stored.javaOptions = {
    ...stored.javaOptions!,
    skipCompatibilityChecks: true,
    garbageCollector: "zgc",
    customArguments: ["-Dnot-duplicated=yes"],
  };
  stored.minecraftOptions = {
    ...stored.minecraftOptions!,
    elyPatch: "eligible",
    hideLauncher: true,
    consoleOnLaunch: false,
    recordGameTime: false,
    showGameTime: false,
  };
  const result = effectiveGameSettings(
    global,
    instanceSettingsSchema.parse(stored),
  );
  expect(result).toMatchObject({
    memoryMin: 2,
    memoryMax: 8,
    javaPath: "/custom/java",
    fullscreen: true,
    resolutionWidth: 1600,
    accountId: "offline:test",
    joinWorld: "World 1",
    environment: {},
    preLaunchCommand: "",
    wrapperCommand: "/wrapper",
    glfwPath: "",
    javaOptions: {
      memoryMinMiB: 2048,
      memoryMaxMiB: 8192,
      skipCompatibilityChecks: true,
      garbageCollector: "zgc",
      customArguments: [],
    },
    minecraftOptions: {
      elyPatch: "eligible",
      hideLauncher: true,
      consoleOnLaunch: false,
      recordGameTime: false,
      showGameTime: false,
    },
  });
  expect(presetArguments(result.javaOptions!)).toEqual(["-XX:+UseZGC"]);
  stored.overrides.commands = false;
  stored.overrides.environment = false;
  stored.overrides.nativeLibraries = false;
  expect(effectiveGameSettings(global, stored)).toMatchObject({
    preLaunchCommand: "/global/start",
    wrapperCommand: "",
    environment: global.minecraft!.environment,
    glfwPath: "/global/glfw",
  });
});

it("keeps legacy settings effective and infers switches without overwriting account or launch policy", () => {
  const stored = {
    ...defaultInstanceSettings(global),
    overrides: undefined,
    javaPath: "/old/java",
    memoryMax: 2,
    accountId: "legacy-account",
    environment: { SHARED: "old" },
  };
  const before = effectiveGameSettings(global, stored);
  const upgraded = {
    ...stored,
    overrides: instanceOverrides(stored),
    environment: before.environment,
    jvmArguments: [...global.java!.customArguments, ...stored.jvmArguments],
  };
  expect(effectiveGameSettings(global, upgraded)).toMatchObject({
    javaPath: before.javaPath,
    memoryMax: before.memoryMax,
    accountId: before.accountId,
    environment: before.environment,
    preLaunchCommand: before.preLaunchCommand,
  });
});

it("validates overrides at the main-process schema boundary", () => {
  const stored = defaultInstanceSettings(global);
  for (const key of ["javaInstallation", "account", "autoJoin"] as const)
    expect(
      instanceSettingsSchema.safeParse({
        ...stored,
        overrides: { ...stored.overrides, [key]: true },
      }).success,
    ).toBe(false);
  expect(
    instanceSettingsSchema.safeParse({
      ...stored,
      overrides: { ...stored.overrides, nativeLibraries: true },
      nativeLibraries: { glfw: true, openAl: false, openGl: false },
      glfwPath: "",
    }).success,
  ).toBe(false);
  expect(
    instanceSettingsSchema.safeParse({
      ...stored,
      wrapperCommand: "bad\0command",
    }).success,
  ).toBe(false);
  expect(
    instanceSettingsSchema.safeParse({
      ...stored,
      javaOptions: {
        ...stored.javaOptions,
        memoryMinMiB: 4096,
        memoryMaxMiB: 1024,
      },
    }).success,
  ).toBe(false);
  expect(
    instanceSettingsSchema.safeParse({
      ...stored,
      environment: { "bad-key": "value" },
    }).success,
  ).toBe(false);
});

it("passes effective flags once and keeps wrapper arguments and credentials separate", () => {
  const stored = defaultInstanceSettings(global);
  stored.overrides = {
    ...stored.overrides!,
    javaArguments: true,
    memory: true,
    gameWindow: true,
    autoJoin: true,
    commands: true,
  };
  stored.javaOptions = { ...stored.javaOptions!, garbageCollector: "zgc" };
  stored.jvmArguments = ["-Dexample=one value"];
  stored.joinServer = "play.example.test:25566";
  stored.wrapperCommand = '"/my wrapper" --option';
  const effective = effectiveGameSettings(global, stored);
  const game = {
    java: "/Java Home/bin/java",
    root: "/game",
    gameAssets: "/assets",
    natives: "/natives",
    gameDir: "/game space",
    classpath: ["/libs/a.jar"],
    logConfig: undefined,
    version: {
      id: "1.20.1",
      mainClass: "Main",
      type: "release",
      assetIndex: { id: "5" },
      arguments: { jvm: [], game: ["--accessToken", "${auth_access_token}"] },
    } as unknown as Version,
  };
  const args = launchArguments(
    game,
    {
      username: "Player",
      uuid: "uuid",
      accessToken: "SECRET_TEST_TOKEN",
      userType: "mojang",
    },
    effective,
  );
  expect(args.filter((arg) => arg === "-XX:+UseZGC")).toHaveLength(1);
  expect(args.filter((arg) => arg === "-Dexample=one value")).toHaveLength(1);
  expect(args).toContain("-Xmx4G");
  expect(args.slice(-4)).toEqual([
    "--server",
    "play.example.test",
    "--port",
    "25566",
  ]);
  const process = launchProcess(game.java, args, effective.wrapperCommand);
  expect(process.executable).toBe("/my wrapper");
  expect(process.arguments).toEqual(["--option", game.java, ...args]);
  expect(
    process.arguments.filter((arg) => arg === "SECRET_TEST_TOKEN"),
  ).toHaveLength(1);
  expect(launchProcess(game.java, args).executable).toBe(game.java);
  game.version.arguments!.game.push(
    {
      rules: [
        { action: "allow", features: { is_quick_play_multiplayer: true } },
      ],
      value: ["--quickPlayMultiplayer", "${quickPlayMultiplayer}"],
    },
    {
      rules: [
        { action: "allow", features: { is_quick_play_singleplayer: true } },
      ],
      value: ["--quickPlaySingleplayer", "${quickPlaySingleplayer}"],
    },
  );
  const modern = launchArguments(
    game,
    { username: "Player", uuid: "uuid", accessToken: "0" },
    effective,
  );
  expect(modern.slice(-2)).toEqual([
    "--quickPlayMultiplayer",
    "play.example.test:25566",
  ]);
  expect(modern).not.toContain("--server");
  effective.joinServer = "";
  effective.joinWorld = "World with spaces";
  expect(
    launchArguments(
      game,
      { username: "Player", uuid: "uuid", accessToken: "0" },
      effective,
    ).slice(-2),
  ).toEqual(["--quickPlaySingleplayer", "World with spaces"]);
  game.version.arguments!.game = [];
  expect(() =>
    launchArguments(
      game,
      { username: "Player", uuid: "uuid", accessToken: "0" },
      effective,
    ),
  ).toThrow("Quick Play");
});

it("persists all five tabs through the real SQLite library store", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "gorth-instance-overrides-"),
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
    const settings = defaultInstanceSettings(global);
    settings.overrides = {
      ...settings.overrides!,
      javaInstallation: true,
      commands: true,
      javaArguments: true,
      gameTime: true,
      environment: true,
      nativeLibraries: true,
    };
    settings.javaPath = "/custom/java";
    settings.javaOptions = {
      ...settings.javaOptions!,
      garbageCollector: "zgc",
    };
    settings.minecraftOptions = {
      ...settings.minecraftOptions!,
      showGameTime: false,
    };
    settings.wrapperCommand = "/wrapper";
    settings.environment = { ONLY_INSTANCE: "yes" };
    settings.nativeLibraries = { glfw: false, openAl: false, openGl: false };
    await store.command({ action: "instance.settings", id, settings });
    store.close();
    store = await createLibraryStore(directory, () => false);
    expect(store.snapshot().instanceSettings[id]).toEqual(settings);
    expect(store.snapshot().instanceSettings[id].javaPaths).toBeUndefined();
  } finally {
    store?.close();
    await rm(directory, { recursive: true, force: true });
  }
});
