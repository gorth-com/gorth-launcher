import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import {
  validateReleaseTag,
  stageReleaseArtifacts,
} from "./release-artifacts.js";

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { stdio: "inherit", env });
  // Never include arguments: signing commands contain credentials.
  if (result.error || result.status !== 0) throw new Error(`${command} failed`);
}

const command = process.argv[2];
const { RELEASE_TAG, TARGET_ARCH, TARGET_PLATFORM, RUNNER_TEMP } = process.env;
const keychain = path.join(RUNNER_TEMP || ".", "gorth-release.keychain-db");
const certificate = path.join(RUNNER_TEMP || ".", "gorth-release.p12");
const login = path.join(
  process.env.HOME || ".",
  "Library/Keychains/login.keychain-db",
);

switch (command) {
  case "check": {
    const metadata = JSON.parse(await readFile("package.json", "utf8"));
    validateReleaseTag(RELEASE_TAG, metadata.version);
    if (process.arch !== TARGET_ARCH || process.platform !== TARGET_PLATFORM)
      throw new Error("Wrong runner platform or architecture");
    break;
  }
  case "install": {
    const env = { ...process.env };
    if (env.DEPENDENCIES_TOKEN) {
      env.GIT_CONFIG_COUNT = "1";
      env.GIT_CONFIG_KEY_0 = `url.https://x-access-token:${env.DEPENDENCIES_TOKEN}@github.com/.insteadOf`;
      env.GIT_CONFIG_VALUE_0 = "https://github.com/";
    }
    // Allow only the native/build tooling already used by the desktop apps.
    run(
      "deno",
      [
        "install",
        "--frozen-lockfile",
        "--allow-scripts=npm:electron,npm:better-sqlite3,npm:electron-winstaller,npm:esbuild,npm:fs-xattr,npm:fsevents,npm:macos-alias,npm:unrs-resolver",
      ],
      env,
    );
    break;
  }
  case "verify":
    run("deno", [
      "run",
      "-A",
      "node_modules/typescript/bin/tsc",
      "--noEmit",
      "--incremental",
      "false",
    ]);
    run("deno", [
      "task",
      "test",
      "tests/vitest/release-artifacts.test.ts",
      "tests/vitest/environment.test.ts",
    ]);
    break;
  case "linux-tools":
    run("sudo", ["apt-get", "update"]);
    run("sudo", ["apt-get", "install", "-y", "rpm", "fakeroot"]);
    break;
  case "sign": {
    for (const name of [
      "CERTIFICATE",
      "CERTIFICATE_PASSWORD",
      "APPLE_ID",
      "APPLE_TEAM_ID",
      "APPLE_APP_PASSWORD",
      "APPLE_NOTARY_PROFILE",
      "RUNNER_TEMP",
    ])
      if (!process.env[name]) throw new Error(`Missing ${name}`);
    const password = randomBytes(24).toString("hex");
    await writeFile(
      certificate,
      Buffer.from(process.env.CERTIFICATE, "base64"),
      { mode: 0o600 },
    );
    run("security", ["create-keychain", "-p", password, keychain]);
    run("security", ["set-keychain-settings", "-lut", "21600", keychain]);
    run("security", ["unlock-keychain", "-p", password, keychain]);
    run("security", [
      "import",
      certificate,
      "-k",
      keychain,
      "-P",
      process.env.CERTIFICATE_PASSWORD,
      "-T",
      "/usr/bin/codesign",
    ]);
    run("security", [
      "set-key-partition-list",
      "-S",
      "apple-tool:,apple:,codesign:",
      "-s",
      "-k",
      password,
      keychain,
    ]);
    run("security", ["list-keychains", "-d", "user", "-s", keychain, login]);
    run("security", ["default-keychain", "-d", "user", "-s", keychain]);
    run("xcrun", [
      "notarytool",
      "store-credentials",
      process.env.APPLE_NOTARY_PROFILE,
      "--apple-id",
      process.env.APPLE_ID,
      "--team-id",
      process.env.APPLE_TEAM_ID,
      "--password",
      process.env.APPLE_APP_PASSWORD,
    ]);
    break;
  }
  case "cleanup":
    try {
      run("security", ["default-keychain", "-d", "user", "-s", login]);
    } finally {
      try {
        if (existsSync(keychain))
          run("security", ["delete-keychain", keychain]);
      } finally {
        await rm(certificate, { force: true });
      }
    }
    break;
  case "make":
    run("deno", [
      "task",
      "make",
      `--platform=${TARGET_PLATFORM}`,
      `--arch=${TARGET_ARCH}`,
    ]);
    console.log(
      await stageReleaseArtifacts(process.cwd(), TARGET_PLATFORM, TARGET_ARCH),
    );
    break;
  default:
    throw new Error("Unknown release build command");
}
