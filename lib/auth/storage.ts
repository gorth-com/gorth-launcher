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
let secureStorageReady = false;
export async function requireSecureStorage() {
  let available = false;
  try {
    // Electron SDK 1.7.21 encrypts sessions synchronously. On macOS, checking
    // the async provider as well can request the same Keychain item twice.
    // Keep this compatibility preflight with the SDK's provider until the SDK
    // supports async encryption; vault/proxy storage remains asynchronous.
    available =
      process.platform === "darwin"
        ? safeStorage.isEncryptionAvailable()
        : await safeStorage.isAsyncEncryptionAvailable();
  } catch (error) {
    secureStorageReady = false;
    throw error;
  }
  if (
    !available ||
    (process.platform === "linux" &&
      safeStorage.getSelectedStorageBackend() === "basic_text")
  ) {
    secureStorageReady = false;
    throw new Error("Unlock your system keychain before signing in.");
  }
  secureStorageReady = true;
}
function assertSecureStorageReady() {
  // Better Auth's Storage contract is synchronous; readiness is checked before
  // entering its actions. The SDK still owns encryption of these opaque values.
  if (!secureStorageReady)
    throw new Error("Unlock your system keychain before signing in.");
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
    assertSecureStorageReady();
    return entries()[key] ?? null;
  },
  setItem(key: string, value: unknown) {
    assertSecureStorageReady();
    if (typeof value !== "string" || !key.startsWith("gorth-native."))
      throw new Error("Invalid auth storage key");
    const data = { ...entries(), [key]: value };
    persist(data);
  },
};
