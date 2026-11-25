import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { requireSecureStorage, nativeStorage } from "@/lib/auth/storage";

const storage = vi.hoisted(() => ({
  isEncryptionAvailable: vi.fn(() => true),
  isAsyncEncryptionAvailable: vi.fn(async () => true),
  getSelectedStorageBackend: vi.fn(() => "gnome_libsecret"),
  encryptStringAsync: vi.fn(),
}));
vi.mock("electron", () => ({ safeStorage: storage }));
const platform = Object.getOwnPropertyDescriptor(process, "platform")!;
function setPlatform(value: string) {
  Object.defineProperty(process, "platform", { configurable: true, value });
}
beforeEach(() => {
  vi.resetAllMocks();
  storage.isEncryptionAvailable.mockReturnValue(true);
  storage.isAsyncEncryptionAvailable.mockResolvedValue(true);
  storage.getSelectedStorageBackend.mockReturnValue("gnome_libsecret");
});
afterEach(() => {
  Object.defineProperty(process, "platform", platform);
});

it("uses the SDK's existing macOS provider without opening an additional async encryptor", async () => {
  setPlatform("darwin");
  await requireSecureStorage();
  await requireSecureStorage();
  expect(storage.isEncryptionAvailable).toHaveBeenCalledTimes(2);
  expect(storage.isAsyncEncryptionAvailable).not.toHaveBeenCalled();
  expect(storage.encryptStringAsync).not.toHaveBeenCalled();
});
it("fails closed when the SDK provider is unavailable without touching a saved session", async () => {
  setPlatform("darwin");
  storage.isEncryptionAvailable.mockReturnValue(false);
  await expect(requireSecureStorage()).rejects.toThrow("keychain");
  expect(() => nativeStorage.getItem("gorth-native.cookie")).toThrow(
    "keychain",
  );
});
it("preserves async checks and blocks plaintext Linux storage", async () => {
  setPlatform("linux");
  storage.getSelectedStorageBackend.mockReturnValue("basic_text");
  await expect(requireSecureStorage()).rejects.toThrow("keychain");
  expect(storage.isAsyncEncryptionAvailable).toHaveBeenCalledOnce();
  expect(storage.isEncryptionAvailable).not.toHaveBeenCalled();
  expect(() => nativeStorage.setItem("gorth-native.cookie", "value")).toThrow(
    "keychain",
  );
});
it("does not probe or encrypt a dummy value in the startup entry", () => {
  const source = readFileSync(
    new URL("../../app/main.ts", import.meta.url),
    "utf8",
  );
  expect(source).not.toContain("initializeSecureStorage");
  expect(source).not.toContain("encryptStringAsync");
  expect(source).not.toContain("gorth-keychain-startup");
  expect(source).not.toContain('initializeNetworkProxy(["content-websites"])');
});
