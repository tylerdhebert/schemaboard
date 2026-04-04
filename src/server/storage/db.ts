import { Database } from 'bun:sqlite'

export const DB_PATH = './schemaboard.db'

function resolvedDbPath(): string {
  return process.env.SCHEMABOARD_DB_PATH ?? DB_PATH
}

export function runInTransaction<T>(db: Database, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

function ensureSchema(db: Database): void {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS connections (
      name TEXT PRIMARY KEY,
      connection_string TEXT NOT NULL,
      type TEXT NOT NULL,
      excluded_schemas_json TEXT NOT NULL,
      included_tables_json TEXT NOT NULL,
      hide_all_initially INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS group_tables (
      group_id TEXT NOT NULL,
      table_name TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      PRIMARY KEY (group_id, table_name),
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      connection_name TEXT NOT NULL,
      name TEXT NOT NULL,
      state_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      UNIQUE(connection_name, name)
    );

    CREATE TABLE IF NOT EXISTS schema_snapshots (
      id TEXT PRIMARY KEY,
      connection_name TEXT NOT NULL,
      name TEXT NOT NULL,
      schema_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      UNIQUE(connection_name, name)
    );

    CREATE INDEX IF NOT EXISTS idx_group_tables_table_name ON group_tables(table_name);
    CREATE INDEX IF NOT EXISTS idx_workspaces_connection_name ON workspaces(connection_name);
    CREATE INDEX IF NOT EXISTS idx_schema_snapshots_connection_name ON schema_snapshots(connection_name);
  `)

  db.query('INSERT OR IGNORE INTO meta (key, value) VALUES (?, ?)').run('schema_version', '2')
}

function openDatabase(): Database {
  const db = new Database(resolvedDbPath(), { create: true })
  ensureSchema(db)
  return db
}

export function withDatabase<T>(fn: (db: Database) => T): T {
  const db = openDatabase()
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

export function nextSortOrder(
  db: Database,
  table: 'connections' | 'groups' | 'workspaces' | 'schema_snapshots'
): number {
  const row = db.query<{ next_sort_order: number }, []>(`
    SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort_order
    FROM ${table}
  `).get()

  return row?.next_sort_order ?? 0
}

export function nextGroupTableSortOrder(db: Database, groupId: string): number {
  const row = db.query<{ next_sort_order: number }, [string]>(`
    SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort_order
    FROM group_tables
    WHERE group_id = ?
  `).get(groupId)

  return row?.next_sort_order ?? 0
}
