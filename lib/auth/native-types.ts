export interface NativeIdentity {
  id: string;
  name: string;
  email?: string;
  username?: string;
  image?: string;
  emailVerified?: boolean;
  expiresAt: number;
}
