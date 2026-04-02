import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { Database } from 'bun:sqlite'
import { join } from 'path'
import { tmpdir } from 'os'
import { unlinkSync } from 'fs'
import { sqliteAdapter } from './sqlite'

const DB_PATH = join(tmpdir(), `schemaboard-test-${Date.now()}.db`)

beforeAll(() => {
  const db = new Database(DB_PATH)
  db.exec(`
    CREATE TABLE Users (
      id INTEGER PRIMARY KEY,
      email TEXT NOT NULL,
      name TEXT
    );
    CREATE TABLE Posts (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES Users(id),
      title TEXT NOT NULL,
      body TEXT
    );
  `)
  db.close()
})

afterAll(() => {
  try { unlinkSync(DB_PATH) } catch {}
})

describe('sqliteAdapter.fetchSchema', () => {
  test('returns all tables with schema = main', async () => {
    const schema = await sqliteAdapter.fetchSchema(DB_PATH)
    expect(schema.tables).toHaveLength(2)
    expect(schema.tables.every(t => t.schema === 'main')).toBe(true)
  })

  test('detects PK column', async () => {
    const schema = await sqliteAdapter.fetchSchema(DB_PATH)
    const users = schema.tables.find(t => t.name === 'Users')!
    const idCol = users.columns.find(c => c.name === 'id')!
    expect(idCol.isPK).toBe(true)
  })

  test('detects FK column and foreign key entry', async () => {
    const schema = await sqliteAdapter.fetchSchema(DB_PATH)
    const posts = schema.tables.find(t => t.name === 'Posts')!
    const userIdCol = posts.columns.find(c => c.name === 'user_id')!
    expect(userIdCol.isFK).toBe(true)
    expect(userIdCol.referencesTable).toBe('Users')
    expect(userIdCol.referencesColumn).toBe('id')
    expect(schema.foreignKeys).toHaveLength(1)
    expect(schema.foreignKeys[0]).toEqual({
      parentTable: 'Posts',
      parentColumn: 'user_id',
      referencedTable: 'Users',
      referencedColumn: 'id',
    })
  })
})

describe('sqliteAdapter.testConnection', () => {
  test('resolves for valid db path', async () => {
    await expect(sqliteAdapter.testConnection(DB_PATH)).resolves.toBeUndefined()
  })

  test('rejects for missing file', async () => {
    await expect(
      sqliteAdapter.testConnection('/nonexistent/path/does-not-exist.db')
    ).rejects.toThrow('Connection failed')
  })
})
