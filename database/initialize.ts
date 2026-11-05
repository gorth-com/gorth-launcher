// Current bootstrap schema. Applied migrations are immutable historical records.
export const initialSchema = `
CREATE TABLE IF NOT EXISTS game_account (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  username TEXT NOT NULL,
  uuid TEXT NOT NULL,
  credentials BLOB,
  expires_at INTEGER,
  CONSTRAINT game_account_provider_check CHECK(provider IN ('offline', 'ely', 'gorth')),
  CONSTRAINT game_account_offline_credentials_check CHECK(provider != 'offline' OR (credentials IS NULL AND expires_at IS NULL))
);
CREATE TABLE IF NOT EXISTS instance (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  loader TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS launcher_session (
  id INTEGER PRIMARY KEY DEFAULT 1,
  subject TEXT NOT NULL,
  name TEXT NOT NULL,
  credentials BLOB NOT NULL,
  expires_at INTEGER NOT NULL,
  CONSTRAINT launcher_session_singleton_check CHECK(id = 1)
);
CREATE TABLE IF NOT EXISTS setting (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS game_account_provider_uuid_idx ON game_account(provider, uuid);
CREATE UNIQUE INDEX IF NOT EXISTS game_account_offline_username_idx ON game_account(lower(username)) WHERE provider = 'offline';
CREATE INDEX IF NOT EXISTS instance_created_at_idx ON instance(created_at);
`;
