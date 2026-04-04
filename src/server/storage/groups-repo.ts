import type { Database } from 'bun:sqlite'
import type { Group } from '../../types'
import { withDatabase, runInTransaction, nextGroupTableSortOrder, nextSortOrder } from './db'
import { normalizeGroup, uniqueStrings } from './normalizers'
import type { MembershipAction } from './types'

type GroupRow = {
  id: string
  name: string
  color: string
}

type GroupTableRow = {
  group_id: string
  table_name: string
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

export function writeGroupsInDb(db: Database, groups: Group[]): void {
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

  groups.forEach((group, groupIndex) => {
    insertGroup.run(group.id, group.name, group.color, groupIndex)
    group.tables.forEach((tableName, tableIndex) => {
      insertGroupTable.run(group.id, tableName, tableIndex)
    })
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

export function reorderGroups(groupIds: string[]): boolean {
  return withDatabase(db => {
    return runInTransaction(db, () => {
      const uniqueIds = uniqueStrings(groupIds)
      const existingIds = db
        .query<{ id: string }, []>('SELECT id FROM groups ORDER BY sort_order, name')
        .all()
        .map(row => row.id)

      if (uniqueIds.length !== existingIds.length) {
        return false
      }

      const expected = [...existingIds].sort()
      const received = [...uniqueIds].sort()
      if (expected.some((id, index) => id !== received[index])) {
        return false
      }

      const update = db.query('UPDATE groups SET sort_order = ? WHERE id = ?')
      uniqueIds.forEach((groupId, index) => {
        update.run(index, groupId)
      })

      return true
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
