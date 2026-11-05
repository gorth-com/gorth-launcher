import { execFile } from "node:child_process";
import { rmSync } from "node:fs";
import { chmod, mkdir, mkdtemp } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const commandOptions = { timeout: 15_000, maxBuffer: 64_000 };

interface MacAuthHandlerOptions {
  directory: string;
  name: string;
  scheme: string;
  onUrl: (url: string) => Promise<boolean>;
}

function appleScriptString(value: string) {
  return JSON.stringify(value);
}

// Development Electron.app has no app-specific Info.plist. A tiny, app-owned
// macOS bundle receives URL events and relays them to this process, not a second
// Electron runtime. It never implements OAuth or stores authorization codes.
export async function createMacAuthHandler(options: MacAuthHandlerOptions) {
  if (!/^[a-z][a-z0-9.-]+$/.test(options.scheme))
    throw new Error("Invalid callback scheme.");
  const socketDirectory = await mkdtemp(path.join(tmpdir(), "gorth-auth-"));
  await chmod(socketDirectory, 0o700);
  const socket = path.join(socketDirectory, "callback.sock");
  const server = createServer(async (request, response) => {
    // This socket is private to the OS user; it is never a TCP/HTTP endpoint.
    if (request.method !== "POST" || request.url !== "/callback") {
      response.writeHead(404).end();
      return;
    }
    try {
      let body = "";
      for await (const chunk of request) {
        body += chunk.toString("utf8");
        if (Buffer.byteLength(body) > 4096) {
          response.writeHead(413).end();
          request.destroy();
          return;
        }
      }
      const accepted = await options.onUrl(body);
      response.writeHead(accepted ? 204 : 400).end();
    } catch {
      // Do not log callback URLs or errors containing authorization codes.
      if (!response.headersSent) response.writeHead(400).end();
      else response.destroy();
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.unref();
  function dispose() {
    server.closeAllConnections();
    server.close();
    // Electron does not wait for async will-quit handlers. Remove only this
    // mkdtemp-owned directory synchronously so shutdown cannot leave a socket.
    rmSync(socketDirectory, { recursive: true, force: true });
  }
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(socket, () => {
        server.removeListener("error", reject);
        resolve();
      });
    });
    await chmod(socket, 0o600);
    // A fixed app-specific path lets LaunchServices replace stale dev handlers.
    const bundlePath = path.join(options.directory, options.name + ".app");
    await mkdir(options.directory, { recursive: true, mode: 0o700 });
    const script = `on open location callbackURL
  if length of callbackURL > 4096 then return
  if callbackURL does not start with ${appleScriptString(options.scheme + "://auth/callback#token=")} then return
  set commandText to "/usr/bin/curl --silent --fail --max-time 15 --noproxy '*' --unix-socket " & quoted form of ${appleScriptString(socket)} & " --request POST --data-binary " & quoted form of callbackURL & " http://localhost/callback >/dev/null 2>&1"
  try
    do shell script commandText
  end try
end open location`;
    await run(
      "/usr/bin/osacompile",
      ["-o", bundlePath, "-e", script],
      commandOptions,
    );
    const plist = path.join(bundlePath, "Contents", "Info.plist");
    const bundleId = options.scheme + ".development-auth";
    for (const [key, type, value] of [
      ["CFBundleIdentifier", "-string", bundleId],
      ["CFBundleName", "-string", options.name],
      ["CFBundleDisplayName", "-string", options.name],
      ["LSUIElement", "-bool", "true"],
      [
        "CFBundleURLTypes",
        "-json",
        JSON.stringify([
          {
            CFBundleURLName: bundleId,
            CFBundleURLSchemes: [options.scheme],
            CFBundleTypeRole: "Viewer",
          },
        ]),
      ],
    ]) {
      await run(
        "/usr/bin/plutil",
        ["-replace", key, type, value, plist],
        commandOptions,
      );
    }
    // Re-sign after modifying the applet plist; never touch Electron.app.
    await run(
      "/usr/bin/codesign",
      ["--force", "--sign", "-", bundlePath],
      commandOptions,
    );
    return { bundlePath, bundleId, dispose };
  } catch {
    await dispose();
    throw new Error("Could not prepare the macOS development login callback.");
  }
}

export async function registerMacAuthHandler(
  bundlePath: string,
  scheme: string,
  bundleId: string,
) {
  // Only our own URL scheme is changed. The system default browser is untouched.
  const script = `ObjC.import("Foundation");
ObjC.import("CoreServices");
function run(args) {
  const url = $.NSURL.fileURLWithPath($(args[0]));
  if ($.LSRegisterURL(url, true) !== 0) throw new Error("Registration failed");
  if ($.LSSetDefaultHandlerForURLScheme($(args[1]), $(args[2])) !== 0)
    throw new Error("Default handler registration failed");
}`;
  try {
    await run(
      "/usr/bin/osascript",
      ["-l", "JavaScript", "-e", script, bundlePath, scheme, bundleId],
      commandOptions,
    );
  } catch (error) {
    throw new Error(
      "Could not register the macOS development login callback.",
      { cause: error },
    );
  }
}
