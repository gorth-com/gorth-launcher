import { requireSecureStorage } from "@/lib/auth/storage";
let user: {
  id: string;
  name: string;
  email: string;
  username?: string;
  image?: string;
  emailVerified?: boolean;
  expiresAt: number;
  verifiedAt: number;
  canRefresh: boolean;
  needsLogin: boolean;
} | null = null;
export function gorthSnapshot() {
  return { user, configured: true, locked: !user };
}
export function getGorthUserId() {
  return user?.id ?? null;
}
export function onGorthChanged() {
  return () => {};
}
export async function loginGorth() {
  await requireSecureStorage();
  user = {
    id: "verified-subject",
    name: "Before",
    email: "before@example.test",
    expiresAt: Date.now() + 3600_000,
    verifiedAt: Date.now(),
    canRefresh: true,
    needsLogin: false,
  };
}
export async function restoreGorthSession() {
  await requireSecureStorage();
  if (user)
    user = {
      ...user,
      name: "After",
      email: "after@example.test",
      username: "changed",
      image: "https://example.test/avatar.png",
      emailVerified: true,
      verifiedAt: Date.now(),
    };
}
export async function signOutGorth() {
  user = null;
}
