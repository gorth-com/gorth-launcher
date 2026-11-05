import { app } from "electron";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/node-sqlite";
import { eq } from "drizzle-orm";
import { userProfileTable } from "@/database/schema";
import { userProfileMigration } from "@/database/migrations/user-profile";
import { migrateSingularTables } from "@/database/migrations/singular-table";
import type { UserProfileIdentity } from "@/lib/server/interface";

function profileDatabase(filename: string) {
  const client = new DatabaseSync(filename);
  try {
    client.exec("PRAGMA busy_timeout = 5000;");
    migrateSingularTables(client);
    client.exec(userProfileMigration);
    return { client, db: drizzle({ client }) };
  } catch (error) {
    client.close();
    throw error;
  }
}
const defaultFilename = () =>
  path.join(app.getPath("userData"), "gorth-launcher.db");

// Only verified OIDC/userinfo identities reach this service; no renderer-supplied identity.
export function upsertUserProfile(
  identity: UserProfileIdentity,
  filename = defaultFilename(),
) {
  const { client, db } = profileDatabase(filename);
  try {
    const now = Date.now();
    const profile = {
      ssoUserId: identity.id,
      name: identity.name,
      username: identity.username ?? null,
      email: identity.email ?? null,
      image: identity.image ?? null,
      emailVerified: identity.emailVerified ?? null,
      syncedAt: now,
    };
    db.insert(userProfileTable)
      .values({ ...profile, createdAt: now })
      .onConflictDoUpdate({ target: userProfileTable.ssoUserId, set: profile })
      .run();
  } finally {
    client.close();
  }
}
export function getUserProfile(
  ssoUserId: string,
  filename = defaultFilename(),
) {
  const { client, db } = profileDatabase(filename);
  try {
    return (
      db
        .select()
        .from(userProfileTable)
        .where(eq(userProfileTable.ssoUserId, ssoUserId))
        .get() ?? null
    );
  } finally {
    client.close();
  }
}
