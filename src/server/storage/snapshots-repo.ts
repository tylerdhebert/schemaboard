import type { Database } from 'bun:sqlite'
import type { SchemaSnapshot, SchemaSnapshotSummary } from '../../types'
import { withDatabase, runInTransaction, nextSortOrder } from './db'
import { normalizeSchemaData, parseSchemaData } from './normalizers'
import type { SaveResult } from './types'

type SnapshotRow = {
  id: string
  connection_name: string
  name: string
  schema_json: string
  created_at: string
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
