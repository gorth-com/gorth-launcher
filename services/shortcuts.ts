import { app } from "electron";
import path from "node:path";
import { eq } from "drizzle-orm";
import { openDatabase } from "@/database/client";
import { settingTable } from "@/database/schema";

export function readShortcutOverrides(): Record<string, string> {
  const { client, db } = openDatabase(
    path.join(app.getPath("userData"), "gorth-launcher.db"),
  );
  try {
    const value = db
      .select()
      .from(settingTable)
      .where(eq(settingTable.key, "shortcuts"))
      .get()?.value;
    return value ? JSON.parse(value) : {};
  } finally {
    client.close();
  }
}
export function writeShortcutOverrides(value: Record<string, string>) {
  const { client, db } = openDatabase(
    path.join(app.getPath("userData"), "gorth-launcher.db"),
  );
  try {
    db.insert(settingTable)
      .values({ key: "shortcuts", value: JSON.stringify(value) })
      .onConflictDoUpdate({
        target: settingTable.key,
        set: { value: JSON.stringify(value) },
      })
      .run();
  } finally {
    client.close();
  }
}
