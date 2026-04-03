import { describe, test, expect, afterEach } from 'bun:test'
import { readConfig, writeConfig } from './config'
import { unlinkSync, existsSync } from 'fs'

const TEST_PATH = './test-schemaboard.config.json'
process.env.SCHEMABOARD_CONFIG_PATH = TEST_PATH

describe('config', () => {
  afterEach(() => {
    if (existsSync(TEST_PATH)) unlinkSync(TEST_PATH)
  })

  test('readConfig returns empty defaults when file missing', () => {
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
})
