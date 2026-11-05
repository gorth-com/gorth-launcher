import { afterEach, beforeEach, expect, it, vi } from "vitest";
import path from "node:path";

const native = vi.hoisted(() => ({
  isPackaged: false,
  getPath: vi.fn(() => "/isolated/profile"),
  getName: vi.fn(() => "Gorth Test"),
  getAppPath: vi.fn(() => "/project with spaces/app"),
  setAsDefaultProtocolClient: vi.fn(() => true),
  once: vi.fn(),
}));
const mac = vi.hoisted(() => ({
  createMacAuthHandler: vi.fn(),
  registerMacAuthHandler: vi.fn(),
  dispose: vi.fn(async () => {}),
}));
vi.mock("electron", () => ({ app: native }));
vi.mock("@/main/services/macos-auth-handler", () => mac);
const platform = Object.getOwnPropertyDescriptor(process, "platform")!;
const defaultApp = Object.getOwnPropertyDescriptor(process, "defaultApp");
const onUrl = vi.fn(async () => true);

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  native.isPackaged = false;
  native.setAsDefaultProtocolClient.mockReturnValue(true);
  mac.createMacAuthHandler.mockResolvedValue({
    bundlePath: "/isolated/Gorth Test.app",
    bundleId: "com.gorth.test.development-auth",
    dispose: mac.dispose,
  });
  mac.registerMacAuthHandler.mockResolvedValue(undefined);
  Object.defineProperty(process, "platform", {
    configurable: true,
    value: "darwin",
  });
  Object.defineProperty(process, "defaultApp", {
    configurable: true,
    value: true,
  });
});
afterEach(() => {
  Object.defineProperty(process, "platform", platform);
  if (defaultApp) Object.defineProperty(process, "defaultApp", defaultApp);
  else Reflect.deleteProperty(process, "defaultApp");
});

it("registers a dedicated macOS dev bundle once, never the bare Electron runtime", async () => {
  const { prepareAuthProtocol } = await import("@/main/services/auth-protocol");
  await Promise.all([
    prepareAuthProtocol("com.gorth.test", onUrl),
    prepareAuthProtocol("com.gorth.test", onUrl),
  ]);
  expect(mac.createMacAuthHandler).toHaveBeenCalledExactlyOnceWith({
    directory: path.join("/isolated/profile", "development-auth"),
    name: "Gorth Test",
    scheme: "com.gorth.test",
    onUrl,
  });
  expect(mac.registerMacAuthHandler).toHaveBeenCalledExactlyOnceWith(
    "/isolated/Gorth Test.app",
    "com.gorth.test",
    "com.gorth.test.development-auth",
  );
  expect(native.setAsDefaultProtocolClient).not.toHaveBeenCalled();
  expect(native.once).toHaveBeenCalledWith("will-quit", expect.any(Function));
  const dispose = native.once.mock.calls[0][1] as () => void;
  dispose();
  expect(mac.dispose).toHaveBeenCalledOnce();
});

it("disposes a failed macOS registration and allows the next login to retry", async () => {
  const { prepareAuthProtocol } = await import("@/main/services/auth-protocol");
  mac.registerMacAuthHandler.mockRejectedValueOnce(new Error("OS refused"));
  await expect(prepareAuthProtocol("com.gorth.test", onUrl)).rejects.toThrow(
    "OS refused",
  );
  expect(mac.dispose).toHaveBeenCalledOnce();
  await prepareAuthProtocol("com.gorth.test", onUrl);
  expect(mac.createMacAuthHandler).toHaveBeenCalledTimes(2);
});

it("uses Forge's protocol registration for a packaged macOS app", async () => {
  native.isPackaged = true;
  Object.defineProperty(process, "defaultApp", {
    configurable: true,
    value: false,
  });
  const { prepareAuthProtocol } = await import("@/main/services/auth-protocol");
  await prepareAuthProtocol("com.gorth.test", onUrl);
  expect(native.setAsDefaultProtocolClient).toHaveBeenCalledExactlyOnceWith(
    "com.gorth.test",
  );
  expect(mac.createMacAuthHandler).not.toHaveBeenCalled();
});

it("includes the absolute app entry when Windows starts from Electron in dev", async () => {
  Object.defineProperty(process, "platform", {
    configurable: true,
    value: "win32",
  });
  const { prepareAuthProtocol } = await import("@/main/services/auth-protocol");
  await prepareAuthProtocol("com.gorth.test", onUrl);
  expect(native.setAsDefaultProtocolClient).toHaveBeenCalledExactlyOnceWith(
    "com.gorth.test",
    process.execPath,
    [path.resolve(native.getAppPath())],
  );
  expect(mac.createMacAuthHandler).not.toHaveBeenCalled();
});

it("fails registration explicitly rather than opening an unreachable OAuth callback", async () => {
  native.isPackaged = true;
  native.setAsDefaultProtocolClient.mockReturnValueOnce(false);
  const { prepareAuthProtocol } = await import("@/main/services/auth-protocol");
  await expect(prepareAuthProtocol("com.gorth.test", onUrl)).rejects.toThrow(
    "Could not register",
  );
  await prepareAuthProtocol("com.gorth.test", onUrl);
  expect(native.setAsDefaultProtocolClient).toHaveBeenCalledTimes(2);
});
