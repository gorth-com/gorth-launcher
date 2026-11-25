import { randomUUID } from "node:crypto";
import { authUrl } from "@/utils/environment";
import { authClient } from "@/lib/auth/client/index";
import { getGorthUserId } from "@/lib/auth/gorth";
import { profile, trustedUrl } from "./model";
import type { GameAccount } from "@/utils/interface";
import { requestJson, AuthHttpError } from "./http";
export function gameBinding() {
  return authUrl ? new URL("/minecraft", trustedUrl(authUrl, true)).href : "";
}
async function nativeRequest(path: string, signal: AbortSignal, body?: object) {
  // The official SDK owns cookie decryption. Only main sends this credential.
  return requestJson(
    new URL(path, trustedUrl(authUrl, true)),
    {
      method: body ? "POST" : "GET",
      headers: {
        Origin: "com.gorth.launcher:/",
        Cookie: authClient.getCookie(),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    },
    signal,
  );
}
export async function fetchNativeGameProfile(
  signal: AbortSignal,
): Promise<GameAccount | null> {
  const ownerId = getGorthUserId();
  if (!ownerId) throw new Error("Cần đăng nhập Gorth SSO trước.");
  const data = await nativeRequest("/minecraft/me", signal);
  if (!data.profile) return null;
  signal.throwIfAborted();
  if (ownerId !== getGorthUserId())
    throw new Error("Tài khoản Gorth đã thay đổi trong khi đọc hồ sơ game.");
  const player = profile(data.profile);
  return { id: "gorth:" + player.uuid, provider: "gorth", ownerId, ...player };
}
export async function issueNativeGameSession(
  signal: AbortSignal,
): Promise<GameAccount> {
  const ownerId = getGorthUserId();
  if (!ownerId) throw new Error("Cần đăng nhập Gorth SSO trước.");
  const clientToken = randomUUID();
  let data: Record<string, unknown>;
  try {
    data = await nativeRequest("/minecraft/session", signal, { clientToken });
  } catch (error) {
    if (error instanceof AuthHttpError && error.status === 409)
      throw new Error(
        "Hãy tạo tên Minecraft tại trang Profile của website Launcher trước.",
      );
    if (error instanceof AuthHttpError && error.status === 503)
      throw new Error(
        "Dịch vụ Minecraft chưa sẵn sàng. Kiểm tra migration và khóa ký texture trên website.",
      );
    throw error;
  }
  const player = profile(data.selectedProfile),
    binding = gameBinding();
  signal.throwIfAborted();
  if (
    ownerId !== getGorthUserId() ||
    data.clientToken !== clientToken ||
    data.authlibRoot !== binding ||
    typeof data.accessToken !== "string" ||
    data.accessToken.length !== 43 ||
    !/^[A-Za-z0-9_-]{43}$/.test(data.accessToken) ||
    typeof data.expiresAt !== "number" ||
    !Number.isFinite(data.expiresAt) ||
    data.expiresAt <= Date.now() ||
    data.expiresAt > Date.now() + 8 * 60 * 60_000
  )
    throw new Error("Phản hồi phiên Minecraft không hợp lệ.");
  return {
    id: "gorth:" + player.uuid,
    provider: "gorth",
    ownerId,
    ...player,
    clientToken,
    tokens: {
      accessToken: data.accessToken,
      expiresAt: data.expiresAt,
      binding,
      sid: ownerId,
    },
  };
}
