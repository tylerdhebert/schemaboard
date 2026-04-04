import type { AppConfig } from '../types'
import { withDatabase, DB_PATH, runInTransaction } from './storage/db'
import { normalizeAppConfig } from './storage/normalizers'
import { createConnection, deleteConnection, getConnection, listConnections, updateConnection, writeConnectionsInDb } from './storage/connections-repo'
import { createGroup, deleteGroup, listGroups, reorderGroups, updateGroup, updateGroupMembership, writeGroupsInDb } from './storage/groups-repo'
import { createWorkspace, deleteWorkspace, listWorkspaces, updateWorkspace } from './storage/workspaces-repo'
import { createSchemaSnapshot, deleteSchemaSnapshot, getSchemaSnapshot, listSchemaSnapshots } from './storage/snapshots-repo'

export { DB_PATH }
export type { SaveResult } from './storage/types'

export function readConfig(): AppConfig {
  return {
    connections: listConnections(),
    groups: listGroups(),
  }
}

export function writeConfig(config: AppConfig): void {
  const normalized = normalizeAppConfig(config)

  withDatabase(db => {
    runInTransaction(db, () => {
      db.exec(`
        DELETE FROM group_tables;
        DELETE FROM groups;
        DELETE FROM connections;
      `)

      writeConnectionsInDb(db, normalized.connections)
      writeGroupsInDb(db, normalized.groups)
    })
  })
}

export {
  createConnection,
  updateConnection,
  deleteConnection,
  listConnections,
  getConnection,
  createGroup,
  updateGroup,
  deleteGroup,
  listGroups,
  reorderGroups,
  updateGroupMembership,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  listWorkspaces,
  createSchemaSnapshot,
  deleteSchemaSnapshot,
  getSchemaSnapshot,
  listSchemaSnapshots,
}
