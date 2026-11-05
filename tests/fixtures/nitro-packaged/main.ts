import { app } from "electron";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [archive, profile] = process.argv.slice(2);
if (
  !path.isAbsolute(archive) ||
  !path.isAbsolute(profile) ||
  !path.basename(profile).startsWith("gorth-nitro-packaged-test-")
)
  throw new Error("Isolated packaged test paths are required");
app.setPath("userData", profile);
app.setPath("sessionData", profile);
app.disableHardwareAcceleration();
app
  .whenReady()
  .then(async () => {
    const backend = await import(
      /* @vite-ignore */ pathToFileURL(
        path.join(archive, ".vite/server/index.mjs"),
      ).href
    );
    let consumed = false;
    const context = {
      origin: "http://localhost:5500",
      capability: "isolated-capability",
      development: false,
      rendererDirectory: path.join(archive, ".vite/renderer/main_window"),
      getIdentityId: () => null,
      getUserProfile: () => null,
      receiveAuthCallback: () => {
        if (consumed) return false;
        consumed = true;
        return true;
      },
    };
    const request = (url: string, headers: Record<string, string> = {}) =>
      backend.fetch(
        new Request(context.origin + url, {
          headers: { host: "localhost:5500", ...headers },
        }),
        context,
      ) as Promise<Response>;
    assert.deepEqual(await (await request("/health")).json(), { status: "ok" });
    assert.equal(
      (await request("/health", { host: "foreign.test" })).status,
      400,
    );
    assert.equal((await request("/user/profile")).status, 403);
    assert.equal(
      (
        await request("/user/profile", {
          "x-gorth-desktop-session": context.capability,
        })
      ).status,
      401,
    );
    const page = await request("/public/index.html");
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-type")!, /text\/html/);
    const html = await page.text();
    const source = html.match(/<script[^>]*src="([^"]+)"/)![1];
    const script = await request(
      new URL(source, context.origin + "/public/index.html").pathname,
    );
    assert.equal(script.status, 200);
    assert.match(script.headers.get("content-type")!, /javascript/);
    assert.equal((await request("/auth/callback?state=synthetic")).status, 200);
    assert.equal((await request("/auth/callback?state=synthetic")).status, 400);
    assert.equal(
      (await request("/assets/%2f..%2f..%2fpackage.json")).status,
      404,
    );
    console.log("PACKAGED_NITRO_ASAR_OK");
    app.exit(0);
  })
  .catch(() => {
    console.error(
      "Packaged Nitro smoke failed; callback URLs and credentials are not logged.",
    );
    app.exit(1);
  });
