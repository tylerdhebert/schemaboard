import { describe, test, expect, afterEach } from 'bun:test'
import {
  createSchemaSnapshot,
  createConnection,
  createGroup,
  createWorkspace,
  deleteSchemaSnapshot,
  deleteWorkspace,
  getSchemaSnapshot,
  listGroups,
  listSchemaSnapshots,
  listWorkspaces,
  readConfig,
  updateConnection,
  updateGroup,
  updateGroupMembership,
  updateWorkspace,
  writeConfig,
} from './config'
import { unlinkSync, existsSync } from 'fs'

const TEST_DB_PATH = './test-schemaboard.db'

process.env.SCHEMABOARD_DB_PATH = TEST_DB_PATH

function cleanupPath(path: string): void {
  if (existsSync(path)) unlinkSync(path)
}

describe('config', () => {
  afterEach(() => {
    cleanupPath(TEST_DB_PATH)
    cleanupPath(`${TEST_DB_PATH}-shm`)
    cleanupPath(`${TEST_DB_PATH}-wal`)
  })

  test('readConfig returns empty defaults when storage is missing', () => {
    const config = readConfig()
    expect(config.connections).toEqual([])
    expect(config.groups).toEqual([])
  })

  test('writeConfig persists and readConfig retrieves', () => {
    const data = {
      connections: [{ name: 'Test', connectionString: 'Server=test', type: 'sqlserver' as const }],
      groups: [{ id: 'g1', name: 'Orders', color: '#3B82F6', tables: ['Orders'] }]
    }
    writeConfig(data)
    const read = readConfig()
    expect(read.connections[0].name).toBe('Test')
    expect(read.groups[0].name).toBe('Orders')
  })

  test('targeted sqlite helpers handle connection and group mutations', () => {
    const created = createConnection({
      name: 'Primary',
      connectionString: 'Server=primary',
      type: 'sqlserver',
    })

    expect(created.ok).toBe(true)

    const duplicate = createConnection({
      name: 'Primary',
      connectionString: 'Server=primary',
      type: 'sqlserver',
    })

    expect(duplicate).toEqual({ ok: false, reason: 'conflict' })

    const updated = updateConnection('Primary', {
      name: 'Reporting',
      connectionString: 'Host=reporting',
      type: 'postgres',
      excludedSchemas: ['internal', 'internal'],
      includedTables: ['public.orders', 'public.orders'],
      hideAllInitially: true,
    })

    expect(updated.ok).toBe(true)
    if (!updated.ok) {
      throw new Error('expected updated connection')
    }

    expect(updated.value.name).toBe('Reporting')
    expect(updated.value.type).toBe('postgres')
    expect(updated.value.excludedSchemas).toEqual(['internal'])
    expect(updated.value.includedTables).toEqual(['public.orders'])
    expect(updated.value.hideAllInitially).toBe(true)

    createGroup({
      id: 'g1',
      name: 'Orders',
      color: '#3B82F6',
      tables: ['Orders', 'Orders'],
    })

    expect(updateGroupMembership('Products', 'add', 'g1')).toBe(true)
    expect(updateGroupMembership('Orders', 'remove', 'g1')).toBe(true)
    expect(updateGroupMembership('AuditLog', 'add', 'missing')).toBe(false)

    const group = updateGroup('g1', { name: 'Commerce', color: '#10B981' })
    expect(group?.name).toBe('Commerce')
    expect(group?.color).toBe('#10B981')

    expect(updateGroupMembership('Products', 'clear')).toBe(true)
    expect(listGroups()).toEqual([
      {
        id: 'g1',
        name: 'Commerce',
        color: '#10B981',
        tables: [],
      },
    ])
  })

  test('workspace and snapshot helpers persist view state and schema baselines', () => {
    const createdWorkspace = createWorkspace({
      id: 'w1',
      connectionName: 'Primary',
      name: 'API Surface',
      state: {
        selectedTables: ['dbo.Users'],
        hiddenGroups: ['g-hidden'],
        hiddenTables: ['dbo.AuditLog'],
        format: 'ddl',
        layoutType: 'elk',
        compactNodes: true,
        tablePositions: {
          'dbo.Users': { x: 120, y: 240 },
        },
      },
    })

    expect(createdWorkspace.ok).toBe(true)

    const duplicateWorkspace = createWorkspace({
      id: 'w2',
      connectionName: 'Primary',
      name: 'API Surface',
      state: {
        selectedTables: [],
        hiddenGroups: [],
        hiddenTables: [],
        format: 'condensed',
        layoutType: 'dagre',
        compactNodes: false,
        tablePositions: {},
      },
    })

    expect(duplicateWorkspace).toEqual({ ok: false, reason: 'conflict' })

    const updatedWorkspace = updateWorkspace('w1', {
      name: 'Backend API',
      state: {
        selectedTables: ['dbo.Users', 'dbo.Roles'],
        hiddenGroups: [],
        hiddenTables: [],
        format: 'condensed',
        layoutType: 'force',
        compactNodes: false,
        tablePositions: {
          'dbo.Users': { x: 10, y: 20 },
          'dbo.Roles': { x: 30, y: 40 },
        },
      },
    })

    expect(updatedWorkspace.ok).toBe(true)
    if (!updatedWorkspace.ok) {
      throw new Error('expected updated workspace')
    }

    expect(listWorkspaces('Primary')).toEqual([
      {
        id: 'w1',
        connectionName: 'Primary',
        name: 'Backend API',
        state: {
          selectedTables: ['dbo.Users', 'dbo.Roles'],
          hiddenGroups: [],
          hiddenTables: [],
          format: 'condensed',
          layoutType: 'force',
          compactNodes: false,
          tablePositions: {
            'dbo.Users': { x: 10, y: 20 },
            'dbo.Roles': { x: 30, y: 40 },
          },
        },
        createdAt: updatedWorkspace.value.createdAt,
        updatedAt: updatedWorkspace.value.updatedAt,
      },
    ])

    const createdSnapshot = createSchemaSnapshot({
      id: 's1',
      connectionName: 'Primary',
      name: 'Before migration',
      schema: {
        tables: [{
          schema: 'dbo',
          name: 'Users',
          columns: [{
            name: 'Id',
            dataType: 'int',
            maxLength: null,
            numericPrecision: 10,
            numericScale: 0,
            isNullable: false,
            isPK: true,
            isFK: false,
            referencesTable: null,
            referencesColumn: null,
          }],
        }],
        foreignKeys: [],
      },
    })

    expect(createdSnapshot.ok).toBe(true)
    expect(listSchemaSnapshots('Primary')).toEqual([
      {
        id: 's1',
        connectionName: 'Primary',
        name: 'Before migration',
        createdAt: createdSnapshot.ok ? createdSnapshot.value.createdAt : '',
      },
    ])

    const snapshot = getSchemaSnapshot('s1')
    expect(snapshot?.schema.tables[0].name).toBe('Users')

    expect(deleteWorkspace('w1')).toBe(true)
    expect(deleteSchemaSnapshot('s1')).toBe(true)
    expect(listWorkspaces('Primary')).toEqual([])
    expect(listSchemaSnapshots('Primary')).toEqual([])
  })
})
