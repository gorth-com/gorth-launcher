import { beforeEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { initializeSecureStorage } from "@/lib/auth/storage";

const storage = vi.hoisted(() => ({
  isEncryptionAvailable: vi.fn(() => true),
  getSelectedStorageBackend: vi.fn(() => "gnome_libsecret"),
  encryptString: vi.fn(() => Buffer.from("encrypted")),
}));
vi.mock("electron", () => ({ safeStorage: storage }));

beforeEach(() => {
  vi.clearAllMocks();
  storage.isEncryptionAvailable.mockReturnValue(true);
});

it("accesses the native encryption key without reading or writing a saved session", () => {
  initializeSecureStorage();
  expect(storage.encryptString).toHaveBeenCalledExactlyOnceWith(
    "gorth-keychain-startup",
  );
});

it("refuses unavailable secure storage without a plaintext fallback", () => {
  storage.isEncryptionAvailable.mockReturnValue(false);
  expect(initializeSecureStorage).toThrow("keychain");
  expect(storage.encryptString).not.toHaveBeenCalled();
});

it("propagates denied key access without overwriting credentials", () => {
  storage.encryptString.mockImplementationOnce(() => {
    throw new Error("Keychain access denied");
  });
  expect(initializeSecureStorage).toThrow("Keychain access denied");
});

it("initializes only in the owning instance after app readiness and before creating a window", () => {
  const source = readFileSync(
    new URL("../../app/main.ts", import.meta.url),
    "utf8",
  );
  const ready = source.indexOf(".whenReady()");
  const owner = source.indexOf("if (!ownsDataDirectory) return;", ready);
  const initialize = source.indexOf("initializeSecureStorage();", owner);
  const window = source.indexOf("createWindow(", initialize);
  expect(ready).toBeGreaterThan(-1);
  expect(owner).toBeGreaterThan(ready);
  expect(initialize).toBeGreaterThan(owner);
  expect(window).toBeGreaterThan(initialize);
});
