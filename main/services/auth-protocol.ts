import { app } from "electron";
import path from "node:path";
import {
  createMacAuthHandler,
  registerMacAuthHandler,
} from "@/main/services/macos-auth-handler";

let registration: Promise<void> | undefined;

// Call immediately before requestAuth: failures must not send the user into an
// OAuth flow whose callback cannot return to this application.
export async function prepareAuthProtocol(
  scheme: string,
  onUrl: (url: string) => Promise<boolean>,
) {
  if (!registration) {
    registration = register(scheme, onUrl);
  }
  try {
    await registration;
  } catch (error) {
    registration = undefined;
    throw error;
  }
}

async function register(
  scheme: string,
  onUrl: (url: string) => Promise<boolean>,
) {
  if (process.platform === "darwin" && !app.isPackaged) {
    const handler = await createMacAuthHandler({
      directory: path.join(app.getPath("userData"), "development-auth"),
      name: app.getName(),
      scheme,
      onUrl,
    });
    try {
      await registerMacAuthHandler(
        handler.bundlePath,
        scheme,
        handler.bundleId,
      );
    } catch (error) {
      await handler.dispose();
      throw error;
    }
    app.once("will-quit", async () => {
      try {
        await handler.dispose();
      } catch {
        console.warn("Could not clean up the development callback socket.");
      }
    });
    return;
  }
  // Windows development requires the absolute application path, not just the
  // Electron executable. Packaged macOS apps use Forge's CFBundleURLTypes.
  const registered = process.defaultApp
    ? app.setAsDefaultProtocolClient(scheme, process.execPath, [
        path.resolve(app.getAppPath()),
      ])
    : app.setAsDefaultProtocolClient(scheme);
  if (!registered)
    throw new Error("Could not register the desktop login callback.");
}
