import { DatabaseSync } from "node:sqlite";
import { userProfileMigration } from "@/database/migrations/user-profile";
import { migrateSingularTables } from "@/database/migrations/singular-table";
import { drizzle } from "drizzle-orm/node-sqlite";
import { initialSchema } from "./initialize";

// Electron's bundled Node supplies SQLite; no native addon rebuild is required.
export function openDatabase(filename: string) {
  const client = new DatabaseSync(filename);
  client.exec(
    "PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;",
  );
  const version = Number(
    client.prepare("PRAGMA user_version").get()?.user_version ?? 0,
  );
  if (version > 5)
    throw new Error("Database được tạo bởi phiên bản launcher mới hơn.");
  try {
    migrateSingularTables(client);
  } catch (error) {
    client.close();
    throw error;
  }
  if (version < 1) {
    client.exec("BEGIN IMMEDIATE");
    try {
      // Also adopt databases created using Drizzle Studio before runtime storage existed.
      client.exec(initialSchema);
      client.exec("PRAGMA user_version = 1; COMMIT");
    } catch (error) {
      client.exec("ROLLBACK");
      client.close();
      throw error;
    }
  }
  if (version < 2) {
    client.exec("BEGIN IMMEDIATE");
    try {
      const columns = client.prepare("PRAGMA table_info(instance)").all();
      if (!columns.some((column) => column.name === "loader_version"))
        client.exec("ALTER TABLE instance ADD COLUMN loader_version TEXT");
      client.exec("PRAGMA user_version = 2; COMMIT");
    } catch (error) {
      client.exec("ROLLBACK");
      client.close();
      throw error;
    }
  }
  if (version < 3) {
    client.exec("BEGIN IMMEDIATE");
    try {
      const columns = client.prepare("PRAGMA table_info(instance)").all();
      if (!columns.some((column) => column.name === "icon_data"))
        client.exec("ALTER TABLE instance ADD COLUMN icon_data TEXT");
      if (!columns.some((column) => column.name === "group_name"))
        client.exec("ALTER TABLE instance ADD COLUMN group_name TEXT");
      client.exec("PRAGMA user_version = 3; COMMIT");
    } catch (error) {
      client.exec("ROLLBACK");
      client.close();
      throw error;
    }
  }
  if (version < 4) {
    client.exec("BEGIN IMMEDIATE");
    try {
      client.exec(userProfileMigration);
      client.exec("PRAGMA user_version = 4; COMMIT");
    } catch (error) {
      client.exec("ROLLBACK");
      client.close();
      throw error;
    }
  }
  client.exec("PRAGMA user_version = 5");
  return { client, db: drizzle({ client }) };
}
