import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { getTableName, isTable } from "drizzle-orm";
import * as schema from "@/database/schema";
import {
  migrateSingularTables,
  singularTableRenames,
} from "@/database/migrations/singular-table";

describe("singular table migration", () => {
  it("preserves every legacy row, blobs, indexes and foreign keys; runs twice", () => {
    const client = new DatabaseSync(":memory:");
    try {
      client.exec("PRAGMA foreign_keys = ON");
      for (const [previous] of singularTableRenames) {
        client.exec(
          `CREATE TABLE "${previous}" (id TEXT PRIMARY KEY, payload BLOB NOT NULL)`,
        );
        client
          .prepare(`INSERT INTO "${previous}" VALUES (?, ?)`)
          .run("existing", new Uint8Array([0, 1, 255]));
        client.exec(
          `CREATE UNIQUE INDEX "${previous}_payload_idx" ON "${previous}"(payload)`,
        );
      }
      const [previous, current] = singularTableRenames[0];
      client.exec(
        `CREATE TABLE reference (owner TEXT REFERENCES "${previous}"(id)); INSERT INTO reference VALUES ('existing')`,
      );
      migrateSingularTables(client);
      migrateSingularTables(client);
      const tables = client
        .prepare("SELECT name FROM sqlite_schema WHERE type='table'")
        .all()
        .map((row) => row.name);
      for (const [oldName, newName] of singularTableRenames) {
        expect(tables).not.toContain(oldName);
        expect(tables).toContain(newName);
        const row = client.prepare(`SELECT * FROM "${newName}"`).get();
        if (!row) throw new Error(`Missing migrated row in ${newName}`);
        expect(row.id).toBe("existing");
        expect([...(row.payload as Uint8Array)]).toEqual([0, 1, 255]);
        expect(() =>
          client
            .prepare(`INSERT INTO "${newName}" VALUES (?, ?)`)
            .run("duplicate", new Uint8Array([0, 1, 255])),
        ).toThrow();
      }
      expect(
        client.prepare("PRAGMA foreign_key_list(reference)").get()?.table,
      ).toBe(current);
      expect(client.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
      expect(
        client.prepare("PRAGMA integrity_check").get()?.integrity_check,
      ).toBe("ok");
    } finally {
      client.close();
    }
  });
  it("refuses ambiguous old/new tables without changing either row", () => {
    const client = new DatabaseSync(":memory:");
    try {
      const [previous, current] = singularTableRenames[0];
      client.exec(
        `CREATE TABLE "${previous}" (id TEXT); INSERT INTO "${previous}" VALUES ('old'); CREATE TABLE "${current}" (id TEXT); INSERT INTO "${current}" VALUES ('new')`,
      );
      expect(() => migrateSingularTables(client)).toThrow(
        "Both legacy and singular",
      );
      expect(client.prepare(`SELECT id FROM "${previous}"`).get()?.id).toBe(
        "old",
      );
      expect(client.prepare(`SELECT id FROM "${current}"`).get()?.id).toBe(
        "new",
      );
      expect(client.isTransaction).toBe(false);
    } finally {
      client.close();
    }
  });
  it("rolls back table renames if an index destination already exists", () => {
    const client = new DatabaseSync(":memory:");
    try {
      const [previous, current] = singularTableRenames[0];
      client.exec(
        `CREATE TABLE "${previous}" (id TEXT); CREATE INDEX "${previous}_id_idx" ON "${previous}"(id); CREATE TABLE other (id TEXT); CREATE INDEX "${current}_id_idx" ON other(id)`,
      );
      expect(() => migrateSingularTables(client)).toThrow();
      expect(
        client
          .prepare("SELECT name FROM sqlite_schema WHERE type='table'")
          .all()
          .map((row) => row.name),
      ).toContain(previous);
      expect(client.isTransaction).toBe(false);
    } finally {
      client.close();
    }
  });
  it("exports only singular Drizzle table names", () => {
    const names = Object.values(schema).filter(isTable).map(getTableName);
    for (const [previous, current] of singularTableRenames) {
      expect(names).not.toContain(previous);
      expect(names).toContain(current);
    }
  });
});
