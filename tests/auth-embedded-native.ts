import assert from "node:assert/strict";
import { app, BrowserWindow, shell } from "electron";
import { betterAuth } from "better-auth";
import { electron } from "@better-auth/electron";
import { setLoginBrowser } from "@/lib/auth/login-browser";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  loginGorth,
  receiveGorthDeepLink,
  restoreGorthSession,
  signOutGorth,
  gorthSnapshot,
  installGorthAuth,
} from "@/lib/auth/gorth";
import { authClient } from "@/lib/auth/client/index";
assert(app.commandLine.hasSwitch("use-mock-keychain"), "Fixture requires mock Keychain");
assert(process.argv[2] && path.isAbsolute(process.argv[2]), "Fixture requires a disposable profile");
app.setPath("userData", process.argv[2]);
app.setPath("sessionData", process.argv[2]);
// Exercise setup before app readiness without changing the user's OS default.
let fixtureAuth: ReturnType<typeof betterAuth> | undefined;
// Better Fetch captures fetch when setupMain creates the client. Install this
// test-only transport before bootstrap, then attach the in-memory server.
globalThis.fetch = async (input, init) => {
  if (!fixtureAuth) throw new Error("The fixture auth server is not ready.");
  return fixtureAuth.handler(
    input instanceof Request ? input : new Request(input, init),
  );
};
const registerDefaultProtocol = app.setAsDefaultProtocolClient;
app.setAsDefaultProtocolClient = () => true;
installGorthAuth();
app.setAsDefaultProtocolClient = registerDefaultProtocol;
async function run() {
  await app.whenReady();
  const window = new BrowserWindow({
    show: false,
    width: 640,
    height: 480,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  try {
    await window.loadURL(
      "data:text/html,<main>Isolated native auth fixture</main>",
    );
    const auth = betterAuth({
      baseURL: "http://localhost:5503",
      basePath: "/auth",
      secret: "isolated-native-fixture-secret-at-least-32-bytes",
      logger: { disabled: true },
      rateLimit: { enabled: false },
      trustedOrigins: ["http://localhost:5503", "com.gorth.launcher:/"],
      emailAndPassword: { enabled: true },
      plugins: [
        electron({
          clientID: "gorth-launcher",
          cookiePrefix: "gorth",
        }),
      ],
      user: {
        additionalFields: {
          externalUserId: { type: "string", required: true },
        },
      },
      advanced: { cookiePrefix: "gorth" },
    });
    await auth.$context;
    fixtureAuth = auth;
    const authorizations: string[] = [];
    shell.openExternal = async (url) => {
      authorizations.push(url);
    };
    async function beginLogin() {
      const index = authorizations.length;
      const controller = new AbortController();
      const completed = loginGorth(controller.signal).then(
        () => undefined,
        (error: unknown) => error,
      );
      const deadline = Date.now() + 5000;
      while (!authorizations[index]) {
        assert(Date.now() < deadline, "SDK did not open its authorization page");
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      return { controller, completed, authorization: new URL(authorizations[index]) };
    }
    const cancelled = await beginLogin();
    assert.equal(cancelled.authorization.protocol, "http:");
    const query = cancelled.authorization.search;
    const response = await auth.handler(
      new Request("http://localhost:5503/auth/sign-up/email" + query, {
        method: "POST",
        headers: {
          Origin: "http://localhost:5503",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Native Fixture",
          email: "fixture@example.test",
          password: "Test-only-password-123!",
          externalUserId: "fixture-sso-sub",
        }),
      }),
    );
    assert.equal(response.status, 200);
    const cookie = response.headers
      .getSetCookie()
      .find((value) =>
        value.startsWith("gorth.gorth-launcher="),
      );
    assert(
      cookie,
      "The official server plugin did not issue the transfer cookie",
    );
    const oldToken = cookie
      .split(";")[0]
      .slice("gorth.gorth-launcher=".length);
    cancelled.controller.abort();
    assert.match(String(await cancelled.completed), /cancelled/);
    const current = await beginLogin();
    assert.notEqual(current.authorization.searchParams.get("state"), cancelled.authorization.searchParams.get("state"));
    assert.equal(await receiveGorthDeepLink(
      "com.gorth.launcher://auth/callback#token=" + oldToken,
    ), false, "A cancelled callback must not consume the new attempt");
    const transfer = async (authorization: URL) => {
      const response = await auth.handler(new Request(
        "http://localhost:5503/auth/sign-in/email" + authorization.search, {
          method: "POST",
          headers: { Origin: "http://localhost:5503", "Content-Type": "application/json" },
          body: JSON.stringify({ email: "fixture@example.test", password: "Test-only-password-123!" }),
        },
      ));
      assert.equal(response.status, 200);
      const cookie = response.headers.getSetCookie().find((value) => value.startsWith("gorth.gorth-launcher="));
      assert(cookie, "SDK transfer cookie missing");
      return cookie.split(";")[0].slice("gorth.gorth-launcher=".length);
    };
    const token = await transfer(current.authorization);
    assert(
      await receiveGorthDeepLink(
        "com.gorth.launcher://auth/callback#token=" + token,
      ),
    );
    assert.equal(await current.completed, undefined);
    assert.equal(gorthSnapshot().user?.id, "fixture-sso-sub");
    await restoreGorthSession();
    assert.equal(gorthSnapshot().user?.id, "fixture-sso-sub");
    const saved = authClient.getCookie();
    await signOutGorth();
    assert.equal(gorthSnapshot().user, null);
    const oldSession = await auth.handler(
      new Request(
        "http://localhost:5503/auth/get-session?disableCookieCache=true",
        { headers: { Cookie: saved } },
      ),
    );
    assert.equal(await oldSession.json(), null);
    // The Gorth browser choice changes only the navigation target. Use the
    // official SDK's state/challenge and transfer for a second full round trip.
    setLoginBrowser("gorth");
    const gorth = await beginLogin();
    assert.equal(gorth.authorization.protocol, "com.gorth.browser:");
    assert.equal(gorth.authorization.searchParams.get("url"), "http://localhost:5503/auth/desktop");
    assert.equal(await receiveGorthDeepLink(
      "com.gorth.launcher://auth/callback#token=" + await transfer(gorth.authorization),
    ), true);
    assert.equal(await gorth.completed, undefined);
    assert.equal(gorthSnapshot().user?.id, "fixture-sso-sub");
    const stored = await readFile(path.join(process.argv[2], "better-auth.v1.json"), "utf8");
    assert(!stored.includes("fixture@example.test"), "Stored session must remain encrypted");
    await signOutGorth();
    setLoginBrowser("default");
    const invalidPkce = await beginLogin();
    const tampered = new URL(invalidPkce.authorization);
    tampered.searchParams.set("code_challenge", "wrong-challenge");
    await receiveGorthDeepLink(
      "com.gorth.launcher://auth/callback#token=" + await transfer(tampered),
    );
    assert.match(String(await invalidPkce.completed), /Sign-in failed/);
    assert.equal(gorthSnapshot().user, null, "SDK must reject the wrong PKCE challenge");
    assert.equal(BrowserWindow.getAllWindows().length, 1);
    assert.equal(
      await window.webContents.executeJavaScript("typeof window.electronAPI"),
      "undefined",
    );
    console.info(
      "Native auth: SDK PKCE, stale callback, cancellation, browser choices, secure storage, restore and logout passed.",
    );
  } finally {
    window.destroy();
  }
}
async function main() {
  try {
    await run();
    app.quit();
  } catch (error) {
    console.error("Native auth fixture failed:", error);
    app.exit(1);
  }
}
void main();
