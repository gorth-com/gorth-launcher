export interface DesktopServerOptions {
  applicationDirectory: string;
  rendererDirectory?: string;
  development?: boolean;
  origin: string;
  capability: string;
  getIdentityId: () => string | null;
}
export interface UserProfileIdentity {
  id: string;
  name: string;
  username?: string;
  email?: string;
  image?: string;
  emailVerified?: boolean;
}

export interface UserProfileCache {
  ssoUserId: string;
  name: string;
  username: string | null;
  email: string | null;
  image: string | null;
  emailVerified: boolean | null;
  createdAt: number;
  syncedAt: number;
}

export interface DesktopRequestContext extends DesktopServerOptions {
  receiveAuthCallback: (url: string) => boolean;
  getUserProfile: (identityId: string) => UserProfileCache | null;
}
