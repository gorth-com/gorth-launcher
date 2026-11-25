import { app, safeStorage } from "electron";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { emptyAuthData } from "./model";
import { requireSecureStorage } from "./storage";
import type { AuthData } from "@/utils/interface";
import { z } from "@gorth-com/structure/cores/zod";

const tokensSchema = z.object({
  nonce: z
    .string()
    .regex(/^[A-Za-z0-9_-]{43}$/)
    .optional(),
  sid: z.string().optional(),
  refreshExpiresAt: z.number().finite().optional(),
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1).optional(),
  expiresAt: z.number().finite(),
  binding: z.string().min(1),
});
const authSchema = z.object({
  version: z.literal(1),
  launcher: z
    .object({
      id: z.string().min(1),
      name: z.string(),
      email: z.string().optional(),
      username: z.string().optional(),
      image: z.string().optional(),
      emailVerified: z.boolean().optional(),
      verifiedAt: z.number().finite().optional(),
      tokens: tokensSchema,
    })
    .nullable(),
  accounts: z.array(
    z.object({
      id: z.string().min(1),
      provider: z.enum(["offline", "ely", "gorth"]),
      ownerId: z.string().optional(),
      username: z.string(),
      uuid: z.string(),
      tokens: tokensSchema.optional(),
      clientToken: z.string().optional(),
    }),
  ),
  selectedAccountId: z.string().nullable(),
});
function file() {
  return path.join(app.getPath("userData"), "auth.v1.enc");
}
export function vaultExists() {
  return existsSync(file());
}
async function ensureEncryption() {
  // Until @better-auth/electron supports async storage, use its macOS provider
  // for both account stores instead of requesting the same Keychain item twice.
  if (process.platform === "darwin") return requireSecureStorage();
  if (
    !(await safeStorage.isAsyncEncryptionAvailable()) ||
    (process.platform === "linux" &&
      safeStorage.getSelectedStorageBackend() === "basic_text")
  )
    throw new Error(
      "Kho khóa hệ điều hành chưa sẵn sàng. Không lưu token dạng văn bản.",
    );
}
export async function readVault(): Promise<AuthData> {
  let bytes: Buffer;
  try {
    bytes = await readFile(file());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return emptyAuthData();
    throw error;
  }
  await ensureEncryption();
  const legacyMac =
    process.platform === "darwin" &&
    bytes.subarray(0, 3).toString("ascii") === "v10";
  // Keep async-format vaults readable. Subsequent successful writes use the
  // SDK-compatible provider; never discard/rewrite data after a failed unlock.
  const result = legacyMac
    ? safeStorage.decryptString(bytes)
    : (await safeStorage.decryptStringAsync(bytes)).result;
  const data = JSON.parse(result);
  if (!authSchema.safeParse(data).success)
    throw new Error("Kho tài khoản không hợp lệ; dữ liệu được giữ nguyên.");
  return data as AuthData;
}
export async function writeVault(data: AuthData) {
  authSchema.parse(data);
  await ensureEncryption();
  await mkdir(app.getPath("userData"), { recursive: true });
  const temp = file() + "." + randomUUID() + ".tmp";
  const plaintext = JSON.stringify(data);
  const encrypted =
    process.platform === "darwin"
      ? safeStorage.encryptString(plaintext)
      : await safeStorage.encryptStringAsync(plaintext);
  await writeFile(temp, encrypted, { mode: 0o600 });
  await rename(temp, file());
}
