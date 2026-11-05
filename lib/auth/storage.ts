import { app, safeStorage } from "electron";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

// The SDK encrypts values with Electron safeStorage; this adapter only persists
// its opaque ciphertext. It never decrypts the previous custom OAuth vault.
const filename = () =>
  path.join(app.getPath("userData"), "better-auth.v1.json");
export function nativeVaultExists() {
  return existsSync(filename());
}
export function requireSecureStorage() {
  if (
    !safeStorage.isEncryptionAvailable() ||
    (process.platform === "linux" &&
      safeStorage.getSelectedStorageBackend() === "basic_text")
  )
    throw new Error("Unlock your system keychain before signing in.");
}
export function initializeSecureStorage() {
  requireSecureStorage();
  // Availability alone does not access the key. Warm the same synchronous
  // encryptor used by the SDK after app readiness, without persisting a value.
  safeStorage.encryptString("gorth-keychain-startup");
}
function entries(): Record<string, string> {
  if (!nativeVaultExists()) return {};
  const value: unknown = JSON.parse(readFileSync(filename(), "utf8"));
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.entries(value).some(
      ([key, item]) =>
        !key.startsWith("gorth-native.") || typeof item !== "string",
    )
  )
    throw new Error("Invalid saved session. Existing data has been preserved.");
  return value as Record<string, string>;
}
function persist(data: Record<string, string>) {
  mkdirSync(app.getPath("userData"), { recursive: true });
  const temporary = filename() + "." + randomUUID() + ".tmp";
  writeFileSync(temporary, JSON.stringify(data), { mode: 0o600 });
  renameSync(temporary, filename());
}
// Logout can discard encrypted credentials even when the keychain is locked.
export function clearNativeSessionStorage() {
  if (nativeVaultExists()) persist({});
}
export const nativeStorage = {
  getItem(key: string) {
    requireSecureStorage();
    return entries()[key] ?? null;
  },
  setItem(key: string, value: unknown) {
    requireSecureStorage();
    if (typeof value !== "string" || !key.startsWith("gorth-native."))
      throw new Error("Invalid auth storage key");
    const data = { ...entries(), [key]: value };
    persist(data);
  },
};
