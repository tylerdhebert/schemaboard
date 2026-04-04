import type { Database } from 'bun:sqlite'
import type { Connection } from '../../types'
import { withDatabase, runInTransaction, nextSortOrder } from './db'
import { normalizeConnection, parseStoredList, normalizeDbType } from './normalizers'
import type { SaveResult } from './types'

type ConnectionRow = {
  name: string
  connection_string: string
  type: ReturnType<typeof normalizeDbType>
  excluded_schemas_json: string
  included_tables_json: string
  hide_all_initially: number
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

export function writeConnectionsInDb(db: Database, connections: Connection[]): void {
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

  connections.forEach((connection, index) => {
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
