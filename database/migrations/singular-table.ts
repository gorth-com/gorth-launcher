export interface SqliteMigrationClient {
  exec(sql: string): unknown;
  prepare(sql: string): { all(): unknown[] };
}

export const singularTableRenames = [
  ["instances", "instance"],
  ["settings", "setting"],
  ["game_accounts", "game_account"],
  ["user_profiles", "user_profile"],
] as const;

function identifier(value: string) {
  return '"' + value.replaceAll('"', '""') + '"';
}

// Run before CREATE TABLE so an existing profile is adopted, never shadowed by
// empty singular tables. Refuse ambiguous databases rather than merging data.
export function migrateSingularTables(client: SqliteMigrationClient) {
  client.exec("BEGIN IMMEDIATE");
  try {
    const tables = new Set(
      (
        client
          .prepare("SELECT name FROM sqlite_schema WHERE type = 'table'")
          .all() as { name: string }[]
      ).map((row) => row.name),
    );
    for (const [previous, current] of singularTableRenames) {
      if (tables.has(previous) && tables.has(current))
        throw new Error(
          "Both legacy and singular database tables exist: " +
            previous +
            " / " +
            current,
        );
    }
    for (const [previous, current] of singularTableRenames) {
      if (tables.has(previous))
        client.exec(
          "ALTER TABLE " +
            identifier(previous) +
            " RENAME TO " +
            identifier(current),
        );
    }
    // SQLite cannot rename indexes. Recreate only app-owned named indexes in
    // this transaction; unique constraints and all table rows remain intact.
    const indexes = client
      .prepare(
        "SELECT name, sql FROM sqlite_schema WHERE type = 'index' AND sql IS NOT NULL",
      )
      .all() as { name: string; sql: string }[];
    for (const index of indexes) {
      const pair = singularTableRenames.find(([previous]) =>
        index.name.startsWith(previous + "_"),
      );
      if (!pair) continue;
      const current = pair[1] + index.name.slice(pair[0].length);
      const sql = index.sql.replaceAll(index.name, current);
      client.exec("DROP INDEX " + identifier(index.name));
      client.exec(sql);
    }
    client.exec("COMMIT");
  } catch (error) {
    client.exec("ROLLBACK");
    throw error;
  }
}
