import path from "node:path";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { app, session, BrowserWindow } from "electron";
import { initializeNetworkProxy } from "@/main/services/proxy";
import { desktopFetch } from "@/lib/http/transport";
import { fetcher } from "@/utils/fetcher";
const directory = process.argv.at(-1)!;
if (
  !path.isAbsolute(directory) ||
  !path.basename(directory).startsWith("gorth-proxy-")
)
  throw new Error("Isolated profile required");
app.setPath("userData", path.join(directory, "profile"));
app.setPath("sessionData", path.join(directory, "profile"));
const errors: string[] = [];
const result: Record<string, unknown> = {};
const timeout = setTimeout(() => {
  errors.push("Fixture timeout");
  app.quit();
}, 15000);
app.on("will-quit", () => clearTimeout(timeout));
app.on("quit", () =>
  console.log("GORTH_PROXY=" + JSON.stringify({ errors, result })),
);
void (async () => {
  const requests: { url: string; cookie: string | undefined }[] = [];
  const proxy = createServer((request, response) => {
    requests.push({ url: request.url ?? "", cookie: request.headers.cookie });
    if (request.url?.includes("/redirect")) {
      response.writeHead(302, {
        location: "http://proxy-test.invalid/redirected",
      });
      response.end();
    } else {
      response.writeHead(200, { "Content-Type": "text/plain" });
      response.end("through-proxy");
    }
  });
  const target = createServer((_request, response) =>
    response.end("local-direct"),
  );
  try {
    await app.whenReady();
    await new Promise<void>((resolve) => proxy.listen(0, "127.0.0.1", resolve));
    await new Promise<void>((resolve) =>
      target.listen(0, "127.0.0.1", resolve),
    );
    const address = proxy.address();
    const targetAddress = target.address();
    if (
      !address ||
      typeof address === "string" ||
      !targetAddress ||
      typeof targetAddress === "string"
    )
      throw new Error("Missing local ports");
    const controller = await initializeNetworkProxy();
    await session.defaultSession.cookies.set({
      url: "http://proxy-test.invalid",
      name: "private-browser-cookie",
      value: "must-not-leak",
    });
    await controller.save({
      settings: { mode: "http", host: "127.0.0.1", port: address.port },
    });
    result.route = await controller.network.resolveProxy(
      "http://proxy-test.invalid/",
    );
    result.fetch = await (
      await desktopFetch("http://proxy-test.invalid/")
    ).text();
    result.axios = (
      await fetcher<string>({
        method: "GET",
        url: "http://proxy-test.invalid/axios",
      })
    ).data;
    result.local = await (
      await desktopFetch("http://127.0.0.1:" + targetAddress.port)
    ).text();
    const future = session.fromPartition("fixture-later");
    await controller.prepareSession(future);
    result.futureRoute = await future.resolveProxy(
      "http://proxy-test.invalid/",
    );
    result.future = await (
      await future.fetch("http://proxy-test.invalid/future")
    ).text();
    const before = requests.length;
    await fetcher({
      method: "GET",
      url: "http://proxy-test.invalid/redirect",
      redirect: "error",
    }).catch(() => undefined);
    result.redirectRequests = requests.length - before;
    const beforeManual = requests.length;
    const manual = await desktopFetch("http://proxy-test.invalid/redirect", {
      redirect: "manual",
    });
    result.manualRedirect = {
      status: manual.status,
      location: manual.headers.get("location"),
      requests: requests.length - beforeManual,
    };
    result.manualBody = await (
      await desktopFetch("http://proxy-test.invalid/artifact", {
        redirect: "manual",
      })
    ).text();
    const aborted = new AbortController();
    aborted.abort();
    result.manualAbort = await desktopFetch(
      "http://proxy-test.invalid/artifact",
      { redirect: "manual", signal: aborted.signal },
    ).then(
      () => false,
      () => true,
    );
    result.cookieIsolated = requests.every((entry) => !entry.cookie);
    result.persisted = JSON.parse(
      await readFile(
        path.join(directory, "profile/network-proxy.json"),
        "utf8",
      ),
    ).settings;
    let invalidRejected = false;
    try {
      await controller.save({
        settings: {
          mode: "http",
          host: "https://bad.invalid/path",
          port: 8080,
        },
      });
    } catch {
      invalidRejected = true;
    }
    result.invalidRejected = invalidRejected;
    const window = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    result.windowRoute = await window.webContents.session.resolveProxy(
      "http://proxy-test.invalid/",
    );
    await window.loadURL(
      "data:text/html,<title>Untrusted proxy fixture</title>",
    );
    result.untrustedRejected = await window.webContents.executeJavaScript(
      "window.proxyFixture.get().then(() => false, () => true)",
    );
    await controller.save({
      settings: { mode: "direct", host: "", port: 8080 },
    });
    result.direct = await future.resolveProxy("http://proxy-test.invalid/");
    window.destroy();
  } catch (error) {
    errors.push(String(error));
  } finally {
    proxy.closeAllConnections();
    proxy.close();
    target.closeAllConnections();
    target.close();
    app.quit();
  }
})();
