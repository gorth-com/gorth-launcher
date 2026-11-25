import assert from "node:assert/strict";
import { app, BrowserWindow } from "electron";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  startDesktopServer,
  stopDesktopServer,
} from "@/services/desktop-server";
import { registerAuthCallback } from "@/services/auth-callback";
import { rawUpsertUserProfile, rawGetUserProfile } from "@/models/user-profile";
import { createDesktopDevServer } from "@/lib/server/vite";
import { appUrl } from "@/utils/environment";

app.setPath(
  "userData",
  mkdtempSync(path.join(tmpdir(), "gorth-server-native-")),
);
awaitTest();
async function awaitTest() {
  await app.whenReady();
  app.setAppPath(process.cwd());
  let window: BrowserWindow | undefined;
  let vite:
    Awaited<ReturnType<(typeof import("vite"))["createServer"]>> | undefined;
  let identityId: string | null = "native-user";
  let stage = "startup";
  try {
    rawUpsertUserProfile({
      id: "native-user",
      name: "Native Test",
      emailVerified: true,
    });
    const fixture = path.resolve("tests/fixtures/server");
    await startDesktopServer(false, fixture, () => identityId);
    window = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.resolve(".vite/server-native-preload.cjs"),
      },
    });
    stage = "load production renderer";
    await window.loadURL(appUrl + "/public/index.html");
    stage = "renderer assertion";
    assert.equal(
      await window.webContents.executeJavaScript(
        "document.querySelector('h1').textContent",
      ),
      "Desktop server fixture",
    );
    assert.equal((await fetch(appUrl + "/health")).status, 200);
    assert.equal((await fetch(appUrl + "/user/profile")).status, 403);
    stage = "renderer profile fetch";
    let profile = await window.webContents.executeJavaScript(
      "window.testDesktop.profile()",
    );
    assert.equal(profile.status, 200);
    assert.equal(profile.body.profile.ssoUserId, "native-user");
    assert.equal(
      (
        await window.webContents.executeJavaScript(
          "window.testDesktop.profileData()",
        )
      ).ssoUserId,
      "native-user",
    );
    identityId = null;
    profile = await window.webContents.executeJavaScript(
      "window.testDesktop.profile()",
    );
    assert.equal(profile.status, 401);
    assert.equal(
      await window.webContents.executeJavaScript(
        "window.testDesktop.profileData()",
      ),
      null,
    );
    assert.equal(rawGetUserProfile("native-user")?.name, "Native Test");
    stage = "development server";
    stopDesktopServer();
    // Forge uses Vite on the public port; Nitro uses only an OS IPC endpoint in main.
    const { createServer } = await import("vite");
    vite = await createServer({
      configFile: false,
      cacheDir: path.resolve(".vite/native-server-cache"),
      root: fixture,
      server: {
        ...createDesktopDevServer(
          app.getAppPath(),
          Number(new URL(appUrl).port),
        ),
        hmr: false,
      },
    });
    await startDesktopServer(true, fixture, () => identityId);
    await vite.listen();
    await window.loadURL(appUrl + "/public/index.html");
    assert.equal((await fetch(appUrl + "/health")).status, 200);
    identityId = "native-user";
    profile = await window.webContents.executeJavaScript(
      "window.testDesktop.profile()",
    );
    assert.equal(profile.status, 200);
    let consumed = false;
    const remove = registerAuthCallback((value) => {
      if (
        consumed ||
        new URL(value).searchParams.get("state") !== "native-state"
      )
        return false;
      consumed = true;
      return true;
    });
    try {
      assert.equal(
        (
          await fetch(
            appUrl + "/auth/callback?state=native-state&code=test-code",
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await fetch(
            appUrl + "/auth/callback?state=native-state&code=test-code",
          )
        ).status,
        400,
      );
    } finally {
      remove();
    }
    assert.equal(BrowserWindow.getAllWindows().length, 1);
    console.log(
      "Native desktop: packaged assets/API, sandboxed profile bridge, logout cache, same-port Vite/Nitro and callback replay protection passed.",
    );
  } catch (error) {
    const failure = error as Error & {
      code?: string;
      actual?: unknown;
      expected?: unknown;
    };
    console.error(
      "Native failure",
      stage,
      failure.message.replace(/https?:\/\/[^\s)]+/g, "[URL]"),
      failure.name,
      failure.code ?? "",
      typeof failure.actual === "number" ? failure.actual : "",
      typeof failure.expected === "number" ? failure.expected : "",
      failure.stack
        ?.split("\n")
        .filter((line) => line.includes("server-native.cjs"))
        .slice(0, 2)
        .join("\n"),
    );
    process.exitCode = 1;
    console.error(
      "Native desktop server test failed; no credentials or callback URLs were logged.",
    );
  } finally {
    window?.destroy();
    stopDesktopServer();
    await vite?.close();
    app.exit(process.exitCode ?? 0);
  }
}
