import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import { openDatabase } from "@/database/client";
import { instanceTable, settingTable } from "@/database/schema";

it.each([1, 4])(
  "adopts legacy version %s, preserves rows and supports singular service queries",
  (version) => {
    const directory = mkdtempSync(path.join(tmpdir(), "gorth-db-migration-"));
    const filename = path.join(directory, "fixture.db");
    const legacy = new DatabaseSync(filename);
    legacy.exec(`CREATE TABLE instances(id TEXT PRIMARY KEY,name TEXT NOT NULL,version TEXT NOT NULL,loader TEXT NOT NULL,created_at INTEGER NOT NULL);
    INSERT INTO instances VALUES ('existing','World','1.20.1','Vanilla',1);
    CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
    INSERT INTO settings VALUES ('launcher','{"memory":4}');
    PRAGMA user_version = ${version}`);
    if (version === 4)
      legacy.exec(
        "ALTER TABLE instances ADD COLUMN loader_version TEXT; ALTER TABLE instances ADD COLUMN icon_data TEXT; ALTER TABLE instances ADD COLUMN group_name TEXT",
      );
    legacy.close();
    try {
      const { client, db } = openDatabase(filename);
      try {
        expect(db.select().from(instanceTable).get()?.name).toBe("World");
        expect(db.select().from(settingTable).get()?.value).toBe(
          '{"memory":4}',
        );
        db.update(instanceTable)
          .set({ name: "Renamed" })
          .where(eq(instanceTable.id, "existing"))
          .run();
        expect(client.prepare("PRAGMA user_version").get()?.user_version).toBe(
          5,
        );
      } finally {
        client.close();
      }
      const reopened = openDatabase(filename);
      try {
        expect(reopened.db.select().from(instanceTable).get()?.name).toBe(
          "Renamed",
        );
      } finally {
        reopened.client.close();
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

it("initializes a fresh database without legacy plural tables", () => {
  const { client, db } = openDatabase(":memory:");
  try {
    db.insert(instanceTable)
      .values({
        id: "new",
        name: "New",
        version: "1.20.1",
        loader: "Vanilla",
        createdAt: 1,
      })
      .run();
    expect(db.select().from(instanceTable).get()?.loaderVersion).toBeNull();
    expect(
      client
        .prepare("SELECT name FROM sqlite_schema WHERE type='table'")
        .all()
        .map((row) => row.name)
        .sort(),
    ).toEqual([
      "game_account",
      "instance",
      "launcher_session",
      "setting",
      "user_profile",
    ]);
  } finally {
    client.close();
  }
});
