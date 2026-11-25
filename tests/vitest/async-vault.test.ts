import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { emptyAuthData } from "@/lib/auth/model";
import { readVault, writeVault } from "@/lib/auth/vault";

const fixture = vi.hoisted(() => ({
  directory: "",
  available: true,
  syncEncrypt: vi.fn((value: string) => Buffer.from("v10fixture:" + value)),
  syncDecrypt: vi.fn((value: Buffer) =>
    value.toString().slice("v10fixture:".length),
  ),
  encrypt: vi.fn(async (value: string) => Buffer.from("fixture:" + value)),
  decrypt: vi.fn(async (value: Buffer) => ({
    result: value.toString().slice("fixture:".length),
    shouldReEncrypt: false,
  })),
}));
vi.mock("electron", () => ({
  app: { getPath: () => fixture.directory },
  safeStorage: {
    isAsyncEncryptionAvailable: async () => fixture.available,
    isEncryptionAvailable: () => fixture.available,
    encryptString: fixture.syncEncrypt,
    decryptString: fixture.syncDecrypt,
    getSelectedStorageBackend: () => "gnome_libsecret",
    encryptStringAsync: fixture.encrypt,
    decryptStringAsync: fixture.decrypt,
  },
}));
const platform = Object.getOwnPropertyDescriptor(process, "platform")!;
beforeEach(async () => {
  Object.defineProperty(process, "platform", {
    configurable: true,
    value: "linux",
  });
  fixture.directory = await mkdtemp(path.join(tmpdir(), "gorth-async-vault-"));
  fixture.available = true;
  vi.clearAllMocks();
});
afterEach(async () => {
  Object.defineProperty(process, "platform", platform);
  await rm(fixture.directory, { recursive: true, force: true });
});
it("uses the same macOS provider as the SDK for both reading and writing", async () => {
  Object.defineProperty(process, "platform", {
    configurable: true,
    value: "darwin",
  });
  await writeVault(emptyAuthData());
  expect(await readVault()).toEqual(emptyAuthData());
  expect(fixture.syncEncrypt).toHaveBeenCalledOnce();
  expect(fixture.syncDecrypt).toHaveBeenCalledOnce();
  expect(fixture.encrypt).not.toHaveBeenCalled();
  expect(fixture.decrypt).not.toHaveBeenCalled();
});
it("keeps async-format data readable on macOS without changing it during read", async () => {
  Object.defineProperty(process, "platform", {
    configurable: true,
    value: "darwin",
  });
  const file = path.join(fixture.directory, "auth.v1.enc");
  const bytes = Buffer.from("fixture:" + JSON.stringify(emptyAuthData()));
  await writeFile(file, bytes);
  expect(await readVault()).toEqual(emptyAuthData());
  expect(await readFile(file)).toEqual(bytes);
  expect(fixture.syncEncrypt).not.toHaveBeenCalled();
});
it("reads an existing encrypted vault using the async result contract", async () => {
  const bytes = Buffer.from("fixture:" + JSON.stringify(emptyAuthData()));
  await writeFile(path.join(fixture.directory, "auth.v1.enc"), bytes);
  expect(await readVault()).toEqual(emptyAuthData());
  expect(fixture.decrypt).toHaveBeenCalledWith(bytes);
});
it("awaits encryption before atomically persisting the vault", async () => {
  await writeVault(emptyAuthData());
  expect(fixture.encrypt).toHaveBeenCalledWith(JSON.stringify(emptyAuthData()));
  expect(await readVault()).toEqual(emptyAuthData());
});
it("preserves the existing vault if the async key provider is unavailable", async () => {
  const file = path.join(fixture.directory, "auth.v1.enc");
  const bytes = Buffer.from("existing ciphertext");
  await writeFile(file, bytes);
  fixture.available = false;
  await expect(writeVault(emptyAuthData())).rejects.toThrow("Kho khóa");
  expect(await readFile(file)).toEqual(bytes);
  expect(fixture.encrypt).not.toHaveBeenCalled();
});
