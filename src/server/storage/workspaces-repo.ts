import type { Database } from 'bun:sqlite'
import type { Workspace } from '../../types'
import { withDatabase, runInTransaction, nextSortOrder } from './db'
import { normalizeWorkspaceState, parseWorkspaceState } from './normalizers'
import type { SaveResult } from './types'

type WorkspaceRow = {
  id: string
  connection_name: string
  name: string
  state_json: string
  created_at: string
  updated_at: string
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
