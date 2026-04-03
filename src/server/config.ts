import { Database } from 'bun:sqlite'
import type {
  AppConfig,
  Column,
  Connection,
  ContextFormat,
  DbType,
  ForeignKey,
  Group,
  LayoutType,
  SchemaData,
  SchemaSnapshot,
  SchemaSnapshotSummary,
  SchemaTable,
  TablePosition,
  Workspace,
  WorkspaceState,
} from '../types'

export const DB_PATH = './schemaboard.db'

const DEFAULT_CONNECTION_TYPE: DbType = 'sqlserver'
const DEFAULT_WORKSPACE_STATE: WorkspaceState = {
  selectedTables: [],
  hiddenGroups: [],
  hiddenTables: [],
  format: 'condensed',
  layoutType: 'dagre',
  compactNodes: false,
  tablePositions: {},
}

type ConnectionRow = {
  name: string
  connection_string: string
  type: DbType
  excluded_schemas_json: string
  included_tables_json: string
  hide_all_initially: number
}

type GroupRow = {
  id: string
  name: string
  color: string
}

type GroupTableRow = {
  group_id: string
  table_name: string
}

type WorkspaceRow = {
  id: string
  connection_name: string
  name: string
  state_json: string
  created_at: string
  updated_at: string
}

type SnapshotRow = {
  id: string
  connection_name: string
  name: string
  schema_json: string
  created_at: string
}

export type SaveResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: 'not_found' | 'conflict' }

type MembershipAction = 'add' | 'remove' | 'clear'

function resolvedDbPath(): string {
  return process.env.SCHEMABOARD_DB_PATH ?? DB_PATH
}

function normalizeDbType(value: unknown): DbType {
  return value === 'postgres' || value === 'sqlite' || value === 'sqlserver'
    ? value
    : DEFAULT_CONNECTION_TYPE
}

function normalizeLayoutType(value: unknown): LayoutType {
  return value === 'force' || value === 'elk' || value === 'dagre'
    ? value
    : DEFAULT_WORKSPACE_STATE.layoutType
}

function normalizeFormat(value: unknown): ContextFormat {
  return value === 'ddl' || value === 'condensed'
    ? value
    : DEFAULT_WORKSPACE_STATE.format
}

function uniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return []

  return values
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .filter((value, index, array) => array.indexOf(value) === index)
}

function normalizeConnection(input: Partial<Connection> & Pick<Connection, 'name' | 'connectionString'>): Connection {
  return {
    name: input.name,
    connectionString: input.connectionString,
    type: normalizeDbType(input.type),
    excludedSchemas: uniqueStrings(input.excludedSchemas),
    includedTables: uniqueStrings(input.includedTables),
    hideAllInitially: input.hideAllInitially ?? false,
  }
}

function normalizeGroup(input: Partial<Group> & Pick<Group, 'id' | 'name' | 'color'>): Group {
  return {
    id: input.id,
    name: input.name,
    color: input.color,
    tables: uniqueStrings(input.tables),
  }
}

function normalizeAppConfig(config: Partial<AppConfig>): AppConfig {
  const connections = Array.isArray(config.connections)
    ? config.connections
      .filter((connection): connection is Partial<Connection> & Pick<Connection, 'name' | 'connectionString'> =>
        !!connection &&
        typeof connection.name === 'string' &&
        typeof connection.connectionString === 'string'
      )
      .map(normalizeConnection)
    : []

  const groups = Array.isArray(config.groups)
    ? config.groups
      .filter((group): group is Partial<Group> & Pick<Group, 'id' | 'name' | 'color'> =>
        !!group &&
        typeof group.id === 'string' &&
        typeof group.name === 'string' &&
        typeof group.color === 'string'
      )
      .map(normalizeGroup)
    : []

  return { connections, groups }
}

function normalizeTablePositions(value: unknown): Record<string, TablePosition> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  const entries = Object.entries(value).flatMap(([tableId, position]) => {
    if (!position || typeof position !== 'object' || Array.isArray(position)) return []

    const x = (position as { x?: unknown }).x
    const y = (position as { y?: unknown }).y

    if (typeof x !== 'number' || typeof y !== 'number') return []
    return [[tableId, { x, y } satisfies TablePosition]]
  })

  return Object.fromEntries(entries)
}

function normalizeWorkspaceState(state: Partial<WorkspaceState>): WorkspaceState {
  return {
    selectedTables: uniqueStrings(state.selectedTables),
    hiddenGroups: uniqueStrings(state.hiddenGroups),
    hiddenTables: uniqueStrings(state.hiddenTables),
    format: normalizeFormat(state.format),
    layoutType: normalizeLayoutType(state.layoutType),
    compactNodes: state.compactNodes ?? false,
    tablePositions: normalizeTablePositions(state.tablePositions),
  }
}

function normalizeColumn(input: Partial<Column> & Pick<Column, 'name' | 'dataType'>): Column {
  return {
    name: input.name,
    dataType: input.dataType,
    maxLength: typeof input.maxLength === 'number' ? input.maxLength : null,
    numericPrecision: typeof input.numericPrecision === 'number' ? input.numericPrecision : null,
    numericScale: typeof input.numericScale === 'number' ? input.numericScale : null,
    isNullable: input.isNullable ?? false,
    isPK: input.isPK ?? false,
    isFK: input.isFK ?? false,
    referencesTable: typeof input.referencesTable === 'string' ? input.referencesTable : null,
    referencesColumn: typeof input.referencesColumn === 'string' ? input.referencesColumn : null,
  }
}

function normalizeSchemaTable(input: Partial<SchemaTable> & Pick<SchemaTable, 'schema' | 'name'>): SchemaTable {
  const columns = Array.isArray(input.columns)
    ? input.columns
      .filter((column): column is Partial<Column> & Pick<Column, 'name' | 'dataType'> =>
        !!column &&
        typeof column.name === 'string' &&
        typeof column.dataType === 'string'
      )
      .map(normalizeColumn)
    : []

  return {
    schema: input.schema,
    name: input.name,
    columns,
  }
}

function normalizeForeignKey(input: Partial<ForeignKey> & Pick<ForeignKey, 'parentTable' | 'parentColumn' | 'referencedTable' | 'referencedColumn'>): ForeignKey {
  return {
    parentTable: input.parentTable,
    parentColumn: input.parentColumn,
    referencedTable: input.referencedTable,
    referencedColumn: input.referencedColumn,
  }
}

function normalizeSchemaData(input: Partial<SchemaData>): SchemaData {
  const tables = Array.isArray(input.tables)
    ? input.tables
      .filter((table): table is Partial<SchemaTable> & Pick<SchemaTable, 'schema' | 'name'> =>
        !!table &&
        typeof table.schema === 'string' &&
        typeof table.name === 'string'
      )
      .map(normalizeSchemaTable)
    : []

  const foreignKeys = Array.isArray(input.foreignKeys)
    ? input.foreignKeys
      .filter((fk): fk is Partial<ForeignKey> & Pick<ForeignKey, 'parentTable' | 'parentColumn' | 'referencedTable' | 'referencedColumn'> =>
        !!fk &&
        typeof fk.parentTable === 'string' &&
        typeof fk.parentColumn === 'string' &&
        typeof fk.referencedTable === 'string' &&
        typeof fk.referencedColumn === 'string'
      )
      .map(normalizeForeignKey)
    : []

  return { tables, foreignKeys }
}

function runInTransaction<T>(db: Database, fn: () => T): T {
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

function withDatabase<T>(fn: (db: Database) => T): T {
  const db = openDatabase()
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

function parseStoredList(json: string): string[] {
  try {
    return uniqueStrings(JSON.parse(json) as unknown)
  } catch {
    return []
  }
}

function parseWorkspaceState(json: string): WorkspaceState {
  try {
    return normalizeWorkspaceState(JSON.parse(json) as Partial<WorkspaceState>)
  } catch {
    return { ...DEFAULT_WORKSPACE_STATE, tablePositions: {} }
  }
}

function parseSchemaData(json: string): SchemaData {
  try {
    return normalizeSchemaData(JSON.parse(json) as Partial<SchemaData>)
  } catch {
    return { tables: [], foreignKeys: [] }
  }
}

function hydrateConnection(row: ConnectionRow): Connection {
  return {
    name: row.name,
    connectionString: row.connection_string,
    type: normalizeDbType(row.type),
    excludedSchemas: parseStoredList(row.excluded_schemas_json),
    includedTables: parseStoredList(row.included_tables_json),
    hideAllInitially: row.hide_all_initially === 1,
  }
}

function hydrateWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    connectionName: row.connection_name,
    name: row.name,
    state: parseWorkspaceState(row.state_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function hydrateSnapshotSummary(row: SnapshotRow): SchemaSnapshotSummary {
  return {
    id: row.id,
    connectionName: row.connection_name,
    name: row.name,
    createdAt: row.created_at,
  }
}

function hydrateSnapshot(row: SnapshotRow): SchemaSnapshot {
  return {
    ...hydrateSnapshotSummary(row),
    schema: parseSchemaData(row.schema_json),
  }
}

function nextSortOrder(db: Database, table: 'connections' | 'groups' | 'workspaces' | 'schema_snapshots'): number {
  const row = db.query<{ next_sort_order: number }, []>(`
    SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort_order
    FROM ${table}
  `).get()

  return row?.next_sort_order ?? 0
}

function nextGroupTableSortOrder(db: Database, groupId: string): number {
  const row = db.query<{ next_sort_order: number }, [string]>(`
    SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort_order
    FROM group_tables
    WHERE group_id = ?
  `).get(groupId)

  return row?.next_sort_order ?? 0
}

function listConnectionsInDb(db: Database): Connection[] {
  return db
    .query<ConnectionRow, []>(`
      SELECT
        name,
        connection_string,
        type,
        excluded_schemas_json,
        included_tables_json,
        hide_all_initially
      FROM connections
      ORDER BY sort_order, name
    `)
    .all()
    .map(hydrateConnection)
}

function getConnectionInDb(db: Database, name: string): Connection | null {
  const row = db.query<ConnectionRow, [string]>(`
    SELECT
      name,
      connection_string,
      type,
      excluded_schemas_json,
      included_tables_json,
      hide_all_initially
    FROM connections
    WHERE name = ?
  `).get(name)

  return row ? hydrateConnection(row) : null
}

function listGroupsInDb(db: Database): Group[] {
  const groups = db
    .query<GroupRow, []>(`
      SELECT id, name, color
      FROM groups
      ORDER BY sort_order, name
    `)
    .all()
    .map(row => ({ ...row, tables: [] as string[] }))

  const tablesByGroup = new Map<string, string[]>()
  for (const row of db.query<GroupTableRow, []>(`
    SELECT group_id, table_name
    FROM group_tables
    ORDER BY group_id, sort_order, table_name
  `).all()) {
    const tables = tablesByGroup.get(row.group_id) ?? []
    tables.push(row.table_name)
    tablesByGroup.set(row.group_id, tables)
  }

  return groups.map(group => ({
    ...group,
    tables: tablesByGroup.get(group.id) ?? [],
  }))
}

function getGroupInDb(db: Database, id: string): Group | null {
  const row = db.query<GroupRow, [string]>(`
    SELECT id, name, color
    FROM groups
    WHERE id = ?
  `).get(id)

  if (!row) return null

  const tables = db
    .query<{ table_name: string }, [string]>(`
      SELECT table_name
      FROM group_tables
      WHERE group_id = ?
      ORDER BY sort_order, table_name
    `)
    .all(id)
    .map(table => table.table_name)

  return { ...row, tables }
}

function listWorkspacesInDb(db: Database, connectionName: string): Workspace[] {
  return db
    .query<WorkspaceRow, [string]>(`
      SELECT
        id,
        connection_name,
        name,
        state_json,
        created_at,
        updated_at
      FROM workspaces
      WHERE connection_name = ?
      ORDER BY sort_order, updated_at DESC
    `)
    .all(connectionName)
    .map(hydrateWorkspace)
}

function getWorkspaceInDb(db: Database, id: string): Workspace | null {
  const row = db.query<WorkspaceRow, [string]>(`
    SELECT
      id,
      connection_name,
      name,
      state_json,
      created_at,
      updated_at
    FROM workspaces
    WHERE id = ?
  `).get(id)

  return row ? hydrateWorkspace(row) : null
}

function workspaceNameTaken(db: Database, connectionName: string, name: string, excludeId?: string): boolean {
  if (excludeId) {
    const row = db.query<{ id: string }, [string, string, string]>(`
      SELECT id
      FROM workspaces
      WHERE connection_name = ? AND name = ? AND id != ?
      LIMIT 1
    `).get(connectionName, name, excludeId)
    return !!row
  }

  const row = db.query<{ id: string }, [string, string]>(`
    SELECT id
    FROM workspaces
    WHERE connection_name = ? AND name = ?
    LIMIT 1
  `).get(connectionName, name)

  return !!row
}

function listSchemaSnapshotsInDb(db: Database, connectionName: string): SchemaSnapshotSummary[] {
  return db
    .query<SnapshotRow, [string]>(`
      SELECT
        id,
        connection_name,
        name,
        schema_json,
        created_at
      FROM schema_snapshots
      WHERE connection_name = ?
      ORDER BY sort_order DESC, created_at DESC
    `)
    .all(connectionName)
    .map(hydrateSnapshotSummary)
}

function getSchemaSnapshotInDb(db: Database, id: string): SchemaSnapshot | null {
  const row = db.query<SnapshotRow, [string]>(`
    SELECT
      id,
      connection_name,
      name,
      schema_json,
      created_at
    FROM schema_snapshots
    WHERE id = ?
  `).get(id)

  return row ? hydrateSnapshot(row) : null
}

function snapshotNameTaken(db: Database, connectionName: string, name: string): boolean {
  const row = db.query<{ id: string }, [string, string]>(`
    SELECT id
    FROM schema_snapshots
    WHERE connection_name = ? AND name = ?
    LIMIT 1
  `).get(connectionName, name)

  return !!row
}

function writeConfigInDb(db: Database, config: AppConfig): void {
  const normalized = normalizeAppConfig(config)

  runInTransaction(db, () => {
    db.exec(`
      DELETE FROM group_tables;
      DELETE FROM groups;
      DELETE FROM connections;
    `)

    const insertConnection = db.query(`
      INSERT INTO connections (
        name,
        connection_string,
        type,
        excluded_schemas_json,
        included_tables_json,
        hide_all_initially,
        sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    normalized.connections.forEach((connection, index) => {
      insertConnection.run(
        connection.name,
        connection.connectionString,
        connection.type,
        JSON.stringify(connection.excludedSchemas ?? []),
        JSON.stringify(connection.includedTables ?? []),
        connection.hideAllInitially ? 1 : 0,
        index
      )
    })

    const insertGroup = db.query(`
      INSERT INTO groups (
        id,
        name,
        color,
        sort_order
      ) VALUES (?, ?, ?, ?)
    `)

    const insertGroupTable = db.query(`
      INSERT INTO group_tables (
        group_id,
        table_name,
        sort_order
      ) VALUES (?, ?, ?)
    `)

    normalized.groups.forEach((group, groupIndex) => {
      insertGroup.run(group.id, group.name, group.color, groupIndex)
      group.tables.forEach((tableName, tableIndex) => {
        insertGroupTable.run(group.id, tableName, tableIndex)
      })
    })
  })
}

export function readConfig(): AppConfig {
  return withDatabase(db => ({
    connections: listConnectionsInDb(db),
    groups: listGroupsInDb(db),
  }))
}

export function writeConfig(config: AppConfig): void {
  withDatabase(db => {
    writeConfigInDb(db, config)
  })
}

export function listConnections(): Connection[] {
  return withDatabase(db => listConnectionsInDb(db))
}

export function getConnection(name: string): Connection | null {
  return withDatabase(db => getConnectionInDb(db, name))
}

export function createConnection(connection: Connection): SaveResult<Connection> {
  return withDatabase(db => {
    const normalized = normalizeConnection(connection)

    return runInTransaction(db, () => {
      if (getConnectionInDb(db, normalized.name)) {
        return { ok: false, reason: 'conflict' } as const
      }

      db.query(`
        INSERT INTO connections (
          name,
          connection_string,
          type,
          excluded_schemas_json,
          included_tables_json,
          hide_all_initially,
          sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        normalized.name,
        normalized.connectionString,
        normalized.type,
        JSON.stringify(normalized.excludedSchemas ?? []),
        JSON.stringify(normalized.includedTables ?? []),
        normalized.hideAllInitially ? 1 : 0,
        nextSortOrder(db, 'connections')
      )

      return { ok: true, value: normalized } as const
    })
  })
}

export function updateConnection(currentName: string, connection: Connection): SaveResult<Connection> {
  return withDatabase(db => {
    const normalized = normalizeConnection(connection)

    return runInTransaction(db, () => {
      if (!getConnectionInDb(db, currentName)) {
        return { ok: false, reason: 'not_found' } as const
      }

      if (currentName !== normalized.name && getConnectionInDb(db, normalized.name)) {
        return { ok: false, reason: 'conflict' } as const
      }

      const sortRow = db.query<{ sort_order: number }, [string]>(`
        SELECT sort_order
        FROM connections
        WHERE name = ?
      `).get(currentName)

      db.query(`
        UPDATE connections
        SET
          name = ?,
          connection_string = ?,
          type = ?,
          excluded_schemas_json = ?,
          included_tables_json = ?,
          hide_all_initially = ?,
          sort_order = ?
        WHERE name = ?
      `).run(
        normalized.name,
        normalized.connectionString,
        normalized.type,
        JSON.stringify(normalized.excludedSchemas ?? []),
        JSON.stringify(normalized.includedTables ?? []),
        normalized.hideAllInitially ? 1 : 0,
        sortRow?.sort_order ?? nextSortOrder(db, 'connections'),
        currentName
      )

      return { ok: true, value: normalized } as const
    })
  })
}

export function deleteConnection(name: string): boolean {
  return withDatabase(db => {
    const result = runInTransaction(db, () => db.query('DELETE FROM connections WHERE name = ?').run(name))
    return result.changes > 0
  })
}

export function listGroups(): Group[] {
  return withDatabase(db => listGroupsInDb(db))
}

export function createGroup(group: Group): Group {
  return withDatabase(db => {
    const normalized = normalizeGroup(group)

    runInTransaction(db, () => {
      db.query(`
        INSERT INTO groups (
          id,
          name,
          color,
          sort_order
        ) VALUES (?, ?, ?, ?)
      `).run(
        normalized.id,
        normalized.name,
        normalized.color,
        nextSortOrder(db, 'groups')
      )

      const insertGroupTable = db.query(`
        INSERT OR IGNORE INTO group_tables (
          group_id,
          table_name,
          sort_order
        ) VALUES (?, ?, ?)
      `)

      normalized.tables.forEach((tableName, index) => {
        insertGroupTable.run(normalized.id, tableName, index)
      })
    })

    return normalized
  })
}

export function updateGroup(id: string, patch: Partial<Pick<Group, 'name' | 'color' | 'tables'>>): Group | null {
  return withDatabase(db => {
    return runInTransaction(db, () => {
      const existing = getGroupInDb(db, id)
      if (!existing) return null

      const nextGroup = normalizeGroup({
        ...existing,
        ...patch,
        id,
      })

      db.query(`
        UPDATE groups
        SET name = ?, color = ?
        WHERE id = ?
      `).run(nextGroup.name, nextGroup.color, id)

      if (patch.tables) {
        db.query('DELETE FROM group_tables WHERE group_id = ?').run(id)

        const insertGroupTable = db.query(`
          INSERT OR IGNORE INTO group_tables (
            group_id,
            table_name,
            sort_order
          ) VALUES (?, ?, ?)
        `)

        nextGroup.tables.forEach((tableName, index) => {
          insertGroupTable.run(id, tableName, index)
        })
      }

      return nextGroup
    })
  })
}

export function deleteGroup(id: string): boolean {
  return withDatabase(db => {
    const result = runInTransaction(db, () => db.query('DELETE FROM groups WHERE id = ?').run(id))
    return result.changes > 0
  })
}

export function updateGroupMembership(tableName: string, action: MembershipAction, groupId?: string): boolean {
  return withDatabase(db => {
    return runInTransaction(db, () => {
      if (action === 'clear') {
        db.query('DELETE FROM group_tables WHERE table_name = ?').run(tableName)
        return true
      }

      if (!groupId || !getGroupInDb(db, groupId)) {
        return false
      }

      if (action === 'add') {
        db.query(`
          INSERT OR IGNORE INTO group_tables (
            group_id,
            table_name,
            sort_order
          ) VALUES (?, ?, ?)
        `).run(groupId, tableName, nextGroupTableSortOrder(db, groupId))
      } else {
        db.query('DELETE FROM group_tables WHERE group_id = ? AND table_name = ?').run(groupId, tableName)
      }

      return true
    })
  })
}

export function listWorkspaces(connectionName: string): Workspace[] {
  return withDatabase(db => listWorkspacesInDb(db, connectionName))
}

export function createWorkspace(workspace: Omit<Workspace, 'createdAt' | 'updatedAt'>): SaveResult<Workspace> {
  return withDatabase(db => {
    return runInTransaction(db, () => {
      if (workspaceNameTaken(db, workspace.connectionName, workspace.name)) {
        return { ok: false, reason: 'conflict' } as const
      }

      const createdAt = new Date().toISOString()
      const normalizedState = normalizeWorkspaceState(workspace.state)

      db.query(`
        INSERT INTO workspaces (
          id,
          connection_name,
          name,
          state_json,
          created_at,
          updated_at,
          sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        workspace.id,
        workspace.connectionName,
        workspace.name,
        JSON.stringify(normalizedState),
        createdAt,
        createdAt,
        nextSortOrder(db, 'workspaces')
      )

      return {
        ok: true,
        value: {
          id: workspace.id,
          connectionName: workspace.connectionName,
          name: workspace.name,
          state: normalizedState,
          createdAt,
          updatedAt: createdAt,
        },
      } as const
    })
  })
}

export function updateWorkspace(id: string, patch: Pick<Workspace, 'name' | 'state'>): SaveResult<Workspace> {
  return withDatabase(db => {
    return runInTransaction(db, () => {
      const existing = getWorkspaceInDb(db, id)
      if (!existing) {
        return { ok: false, reason: 'not_found' } as const
      }

      if (workspaceNameTaken(db, existing.connectionName, patch.name, id)) {
        return { ok: false, reason: 'conflict' } as const
      }

      const updatedAt = new Date().toISOString()
      const normalizedState = normalizeWorkspaceState(patch.state)

      db.query(`
        UPDATE workspaces
        SET
          name = ?,
          state_json = ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        patch.name,
        JSON.stringify(normalizedState),
        updatedAt,
        id
      )

      return {
        ok: true,
        value: {
          ...existing,
          name: patch.name,
          state: normalizedState,
          updatedAt,
        },
      } as const
    })
  })
}

export function deleteWorkspace(id: string): boolean {
  return withDatabase(db => {
    const result = runInTransaction(db, () => db.query('DELETE FROM workspaces WHERE id = ?').run(id))
    return result.changes > 0
  })
}

export function listSchemaSnapshots(connectionName: string): SchemaSnapshotSummary[] {
  return withDatabase(db => listSchemaSnapshotsInDb(db, connectionName))
}

export function getSchemaSnapshot(id: string): SchemaSnapshot | null {
  return withDatabase(db => getSchemaSnapshotInDb(db, id))
}

export function createSchemaSnapshot(snapshot: Omit<SchemaSnapshot, 'createdAt'>): SaveResult<SchemaSnapshot> {
  return withDatabase(db => {
    return runInTransaction(db, () => {
      if (snapshotNameTaken(db, snapshot.connectionName, snapshot.name)) {
        return { ok: false, reason: 'conflict' } as const
      }

      const createdAt = new Date().toISOString()
      const normalizedSchema = normalizeSchemaData(snapshot.schema)

      db.query(`
        INSERT INTO schema_snapshots (
          id,
          connection_name,
          name,
          schema_json,
          created_at,
          sort_order
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        snapshot.id,
        snapshot.connectionName,
        snapshot.name,
        JSON.stringify(normalizedSchema),
        createdAt,
        nextSortOrder(db, 'schema_snapshots')
      )

      return {
        ok: true,
        value: {
          id: snapshot.id,
          connectionName: snapshot.connectionName,
          name: snapshot.name,
          schema: normalizedSchema,
          createdAt,
        },
      } as const
    })
  })
}

export function deleteSchemaSnapshot(id: string): boolean {
  return withDatabase(db => {
    const result = runInTransaction(db, () => db.query('DELETE FROM schema_snapshots WHERE id = ?').run(id))
    return result.changes > 0
  })
}
