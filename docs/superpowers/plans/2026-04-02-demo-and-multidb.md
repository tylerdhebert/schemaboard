# Demo Mode + Multi-Database Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a demo mode with a hardcoded e-commerce schema and multi-database support for SQL Server, Postgres, and SQLite via a clean adapter pattern.

**Architecture:** Refactor `src/server/schema.ts` into per-adapter modules behind a `DbAdapter` interface; a `getAdapter(type)` factory lets routes stay DB-agnostic. Demo mode uses a `GET /api/schema/demo` endpoint returning hardcoded `SchemaData`; the frontend uses `activeConnection === '__demo__'` as a sentinel to call this route instead of the regular schema fetch. No migration needed — the app has never been used.

**Tech Stack:** Bun, Elysia, mssql (SQL Server), pg (Postgres), bun:sqlite (SQLite built-in), React 19, TanStack Query v5, Eden Treaty.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/types.ts` | Modify | Add `DbType` union + `type: DbType` to `Connection` |
| `src/server/adapters/types.ts` | Create | `DbType` (re-export from src/types) + `DbAdapter` interface |
| `src/server/adapters/shared.ts` | Create | `buildSchemaData` pure function + raw types (moved from schema.ts) |
| `src/server/adapters/sqlserver.ts` | Create | SqlServerAdapter — mssql + sys catalog queries |
| `src/server/adapters/postgres.ts` | Create | PostgresAdapter — pg + INFORMATION_SCHEMA queries |
| `src/server/adapters/sqlite.ts` | Create | SqliteAdapter — bun:sqlite + PRAGMA queries |
| `src/server/adapters/index.ts` | Create | `getAdapter(type: DbType): DbAdapter` factory |
| `src/server/adapters/sqlite.test.ts` | Create | Integration tests for SQLite adapter using temp DB file |
| `src/server/demo-data.ts` | Create | `DEMO_SCHEMA` — 9-table e-commerce schema across 4 schemas |
| `src/server/schema.ts` | Delete | Replaced by adapters; test import updated before deletion |
| `src/server/schema.test.ts` | Modify | Update import path from `./schema` to `./adapters/shared` |
| `src/server/routes/connections.ts` | Modify | Accept `type` in body; use `getAdapter(body.type).testConnection()` |
| `src/server/routes/schema.ts` | Modify | Add `/demo` route; use `getAdapter(conn.type).fetchSchema()` |
| `src/client/components/ConnectionModal.tsx` | Modify | Add `type` state + DB type segmented control |
| `src/client/components/Header.tsx` | Modify | Add "Load Demo" button; show "Demo Mode" option in connection select |
| `src/client/App.tsx` | Modify | Schema query handles `activeConnection === '__demo__'` |

---

### Task 1: Adapter Foundation — Shared Types + SQL Server Adapter

**Files:**
- Create: `src/server/adapters/types.ts`
- Create: `src/server/adapters/shared.ts`
- Create: `src/server/adapters/sqlserver.ts`
- Modify: `src/server/schema.test.ts`

- [ ] **Step 1: Write the updated test (import path change only)**

`src/server/schema.test.ts` — change only the import line:
```ts
import { describe, test, expect } from 'bun:test'
import { buildSchemaData } from './adapters/shared'

describe('buildSchemaData', () => {
  test('merges raw rows into structured SchemaData', () => {
    const rawColumns = [
      { schema: 'dbo', tableName: 'Orders', columnName: 'Id', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: 'NO', defaultValue: null },
      { schema: 'dbo', tableName: 'Orders', columnName: 'CustomerId', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: 'NO', defaultValue: null },
    ]
    const rawPKs = [{ schema: 'dbo', tableName: 'Orders', columnName: 'Id' }]
    const rawFKs = [{
      parentSchema: 'dbo', parentTable: 'Orders', parentColumn: 'CustomerId',
      referencedSchema: 'dbo', referencedTable: 'Customers', referencedColumn: 'Id'
    }]

    const result = buildSchemaData(rawColumns, rawPKs, rawFKs)

    expect(result.tables).toHaveLength(1)
    expect(result.tables[0].name).toBe('Orders')
    expect(result.tables[0].columns[0].isPK).toBe(true)
    expect(result.tables[0].columns[1].isFK).toBe(true)
    expect(result.tables[0].columns[1].referencesTable).toBe('Customers')
    expect(result.foreignKeys).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Verify test fails (module not found)**

Run: `bun test src/server/schema.test.ts`
Expected: FAIL — `Cannot find module './adapters/shared'`

- [ ] **Step 3: Create `src/server/adapters/types.ts`**

```ts
import type { SchemaData } from '../../types'
export type { DbType } from '../../types'

export interface DbAdapter {
  testConnection(connectionString: string): Promise<void>
  fetchSchema(connectionString: string): Promise<SchemaData>
}
```

- [ ] **Step 4: Create `src/server/adapters/shared.ts`**

This is the `buildSchemaData` function and raw types moved verbatim from `src/server/schema.ts`:

```ts
import type { SchemaData, SchemaTable, Column, ForeignKey } from '../../types'

export type RawColumn = {
  schema: string
  tableName: string
  columnName: string
  dataType: string
  maxLength: number | null
  numericPrecision: number | null
  numericScale: number | null
  isNullable: string
  defaultValue: string | null
}
export type RawPK = { schema: string; tableName: string; columnName: string }
export type RawFK = {
  parentSchema: string
  parentTable: string
  parentColumn: string
  referencedSchema: string
  referencedTable: string
  referencedColumn: string
}

export function buildSchemaData(
  rawColumns: RawColumn[],
  rawPKs: RawPK[],
  rawFKs: RawFK[]
): SchemaData {
  const pkSet = new Set(rawPKs.map(pk => `${pk.schema}.${pk.tableName}.${pk.columnName}`))
  const fkMap = new Map(rawFKs.map(fk => [
    `${fk.parentSchema}.${fk.parentTable}.${fk.parentColumn}`,
    { referencesTable: fk.referencedTable, referencesColumn: fk.referencedColumn }
  ]))

  const tableMap = new Map<string, SchemaTable>()

  for (const row of rawColumns) {
    const key = `${row.schema}.${row.tableName}`
    if (!tableMap.has(key)) {
      tableMap.set(key, { schema: row.schema, name: row.tableName, columns: [] })
    }
    const fkInfo = fkMap.get(`${row.schema}.${row.tableName}.${row.columnName}`)
    const column: Column = {
      name: row.columnName,
      dataType: row.dataType,
      maxLength: row.maxLength,
      numericPrecision: row.numericPrecision,
      numericScale: row.numericScale,
      isNullable: row.isNullable === 'YES',
      isPK: pkSet.has(`${row.schema}.${row.tableName}.${row.columnName}`),
      isFK: !!fkInfo,
      referencesTable: fkInfo?.referencesTable ?? null,
      referencesColumn: fkInfo?.referencesColumn ?? null,
    }
    tableMap.get(key)!.columns.push(column)
  }

  const foreignKeys: ForeignKey[] = rawFKs.map(fk => ({
    parentTable: fk.parentTable,
    parentColumn: fk.parentColumn,
    referencedTable: fk.referencedTable,
    referencedColumn: fk.referencedColumn,
  }))

  return { tables: Array.from(tableMap.values()), foreignKeys }
}
```

- [ ] **Step 5: Create `src/server/adapters/sqlserver.ts`**

This is the SQL Server logic moved from `src/server/schema.ts`:

```ts
import sql from 'mssql'
import { buildSchemaData } from './shared'
import type { DbAdapter } from './types'

const COLUMNS_QUERY = `
SELECT
  t.TABLE_SCHEMA  AS [schema],
  t.TABLE_NAME    AS tableName,
  c.COLUMN_NAME   AS columnName,
  c.DATA_TYPE     AS dataType,
  c.CHARACTER_MAXIMUM_LENGTH AS maxLength,
  c.NUMERIC_PRECISION        AS numericPrecision,
  c.NUMERIC_SCALE            AS numericScale,
  c.IS_NULLABLE              AS isNullable,
  c.COLUMN_DEFAULT           AS defaultValue,
  c.ORDINAL_POSITION         AS ordinal
FROM INFORMATION_SCHEMA.TABLES t
JOIN INFORMATION_SCHEMA.COLUMNS c
  ON t.TABLE_NAME = c.TABLE_NAME AND t.TABLE_SCHEMA = c.TABLE_SCHEMA
WHERE t.TABLE_TYPE = 'BASE TABLE'
ORDER BY t.TABLE_SCHEMA, t.TABLE_NAME, c.ORDINAL_POSITION
`

const PKS_QUERY = `
SELECT
  tc.TABLE_SCHEMA AS [schema],
  tc.TABLE_NAME   AS tableName,
  ccu.COLUMN_NAME AS columnName
FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu
  ON tc.CONSTRAINT_NAME = ccu.CONSTRAINT_NAME
WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
`

const FKS_QUERY = `
SELECT
  SCHEMA_NAME(tp.schema_id) AS parentSchema,
  tp.name                   AS parentTable,
  cp.name                   AS parentColumn,
  SCHEMA_NAME(tr.schema_id) AS referencedSchema,
  tr.name                   AS referencedTable,
  cr.name                   AS referencedColumn
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
JOIN sys.tables tp ON fkc.parent_object_id = tp.object_id
JOIN sys.columns cp
  ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id
JOIN sys.columns cr
  ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
`

export const sqlServerAdapter: DbAdapter = {
  async testConnection(connectionString) {
    try {
      const pool = await sql.connect(connectionString)
      await pool.close()
    } catch (err) {
      throw new Error(`Connection failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  },

  async fetchSchema(connectionString) {
    const pool = await sql.connect(connectionString)
    try {
      const [colResult, pkResult, fkResult] = await Promise.all([
        pool.request().query(COLUMNS_QUERY),
        pool.request().query(PKS_QUERY),
        pool.request().query(FKS_QUERY),
      ])
      return buildSchemaData(colResult.recordset, pkResult.recordset, fkResult.recordset)
    } finally {
      await pool.close()
    }
  },
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `bun test src/server/schema.test.ts`
Expected: PASS (1 test, same logic, new import path)

- [ ] **Step 7: Commit**

```bash
git add src/server/schema.test.ts src/server/adapters/types.ts src/server/adapters/shared.ts src/server/adapters/sqlserver.ts
git commit -m "feat: adapter foundation — shared buildSchemaData + SQL Server adapter"
```

---

### Task 2: Postgres Adapter

**Files:**
- Create: `src/server/adapters/postgres.ts`

- [ ] **Step 1: Install `pg` package**

Run: `bun add pg && bun add -d @types/pg`
Expected: `pg` and `@types/pg` added to package.json

- [ ] **Step 2: Create `src/server/adapters/postgres.ts`**

```ts
import { Client } from 'pg'
import { buildSchemaData } from './shared'
import type { DbAdapter } from './types'

// Excludes system schemas; matches same shape as SQL Server INFORMATION_SCHEMA
const COLUMNS_QUERY = `
SELECT
  t.table_schema   AS "schema",
  t.table_name     AS "tableName",
  c.column_name    AS "columnName",
  c.data_type      AS "dataType",
  c.character_maximum_length AS "maxLength",
  c.numeric_precision        AS "numericPrecision",
  c.numeric_scale            AS "numericScale",
  c.is_nullable              AS "isNullable",
  c.column_default           AS "defaultValue"
FROM information_schema.tables t
JOIN information_schema.columns c
  ON t.table_name = c.table_name AND t.table_schema = c.table_schema
WHERE t.table_type = 'BASE TABLE'
  AND t.table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY t.table_schema, t.table_name, c.ordinal_position
`

// Postgres uses key_column_usage (not constraint_column_usage) for PK columns
const PKS_QUERY = `
SELECT
  tc.table_schema AS "schema",
  tc.table_name   AS "tableName",
  kcu.column_name AS "columnName"
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.constraint_schema = kcu.constraint_schema
WHERE tc.constraint_type = 'PRIMARY KEY'
`

// Uses referential_constraints to join parent + referenced key_column_usage rows
const FKS_QUERY = `
SELECT
  kcu_p.table_schema  AS "parentSchema",
  kcu_p.table_name    AS "parentTable",
  kcu_p.column_name   AS "parentColumn",
  kcu_r.table_schema  AS "referencedSchema",
  kcu_r.table_name    AS "referencedTable",
  kcu_r.column_name   AS "referencedColumn"
FROM information_schema.referential_constraints rc
JOIN information_schema.key_column_usage kcu_p
  ON rc.constraint_name = kcu_p.constraint_name
  AND rc.constraint_schema = kcu_p.constraint_schema
JOIN information_schema.key_column_usage kcu_r
  ON rc.unique_constraint_name = kcu_r.constraint_name
  AND rc.unique_constraint_schema = kcu_r.constraint_schema
  AND kcu_p.ordinal_position = kcu_r.position_in_unique_constraint
ORDER BY kcu_p.table_schema, kcu_p.table_name, kcu_p.column_name
`

export const postgresAdapter: DbAdapter = {
  async testConnection(connectionString) {
    const client = new Client({ connectionString })
    try {
      await client.connect()
    } catch (err) {
      throw new Error(`Connection failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      await client.end()
    }
  },

  async fetchSchema(connectionString) {
    const client = new Client({ connectionString })
    await client.connect()
    try {
      const [colResult, pkResult, fkResult] = await Promise.all([
        client.query(COLUMNS_QUERY),
        client.query(PKS_QUERY),
        client.query(FKS_QUERY),
      ])
      return buildSchemaData(colResult.rows, pkResult.rows, fkResult.rows)
    } finally {
      await client.end()
    }
  },
}
```

- [ ] **Step 3: Verify tests still pass**

Run: `bun test`
Expected: 12 pass (no new tests yet; just confirming no regressions)

- [ ] **Step 4: Commit**

```bash
git add src/server/adapters/postgres.ts package.json bun.lockb
git commit -m "feat: Postgres adapter using pg + INFORMATION_SCHEMA queries"
```

---

### Task 3: SQLite Adapter + Tests

**Files:**
- Create: `src/server/adapters/sqlite.ts`
- Create: `src/server/adapters/sqlite.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/server/adapters/sqlite.test.ts`:

```ts
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
    expect(idCol.isNullable).toBe(false)
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

  test('rejects with Connection failed for missing file', async () => {
    await expect(
      sqliteAdapter.testConnection('/nonexistent/path/does-not-exist.db')
    ).rejects.toThrow('Connection failed')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `bun test src/server/adapters/sqlite.test.ts`
Expected: FAIL — `Cannot find module './sqlite'`

- [ ] **Step 3: Create `src/server/adapters/sqlite.ts`**

```ts
import { Database } from 'bun:sqlite'
import type { DbAdapter } from './types'
import type { SchemaData, SchemaTable, Column, ForeignKey } from '../../types'

export const sqliteAdapter: DbAdapter = {
  async testConnection(connectionString) {
    // readonly: true — throws if file doesn't exist (won't create it)
    try {
      const db = new Database(connectionString, { readonly: true })
      db.close()
    } catch (err) {
      throw new Error(`Connection failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  },

  async fetchSchema(connectionString) {
    const db = new Database(connectionString, { readonly: true })
    try {
      const tableNames = db
        .query<{ name: string }, []>(
          `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
        )
        .all()

      const tables: SchemaTable[] = []
      const foreignKeys: ForeignKey[] = []

      for (const { name: tableName } of tableNames) {
        // PRAGMA doesn't support bound parameters for the table name argument.
        // Safe here because table name was returned by sqlite_master (not user input).
        const safeName = tableName.replace(/"/g, '""')

        const colRows = db
          .query<{ cid: number; name: string; type: string; notnull: number; dflt_value: string | null; pk: number }, []>(
            `PRAGMA table_info("${safeName}")`
          )
          .all()

        const fkRows = db
          .query<{ id: number; seq: number; table: string; from: string; to: string }, []>(
            `PRAGMA foreign_key_list("${safeName}")`
          )
          .all()

        const fkByColumn = new Map(fkRows.map(fk => [fk.from, fk]))

        const columns: Column[] = colRows.map(row => {
          const fkRow = fkByColumn.get(row.name)
          return {
            name: row.name,
            dataType: (row.type || 'text').toLowerCase(),
            maxLength: null,
            numericPrecision: null,
            numericScale: null,
            isNullable: row.notnull === 0 && row.pk === 0,
            isPK: row.pk > 0,
            isFK: !!fkRow,
            referencesTable: fkRow?.table ?? null,
            referencesColumn: fkRow?.to ?? null,
          }
        })

        tables.push({ schema: 'main', name: tableName, columns })

        for (const fkRow of fkRows) {
          foreignKeys.push({
            parentTable: tableName,
            parentColumn: fkRow.from,
            referencedTable: fkRow.table,
            referencedColumn: fkRow.to,
          })
        }
      }

      return { tables, foreignKeys }
    } finally {
      db.close()
    }
  },
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test`
Expected: 17 pass (12 original + 5 new SQLite tests), 0 fail

- [ ] **Step 5: Commit**

```bash
git add src/server/adapters/sqlite.ts src/server/adapters/sqlite.test.ts
git commit -m "feat: SQLite adapter using bun:sqlite PRAGMA queries"
```

---

### Task 4: Adapter Factory + Route Updates + Cleanup

This task wires everything together: adds `DbType` to `src/types.ts`, creates the `getAdapter` factory, updates both route files to use adapters, and deletes the now-replaced `src/server/schema.ts`.

**Files:**
- Modify: `src/types.ts`
- Create: `src/server/adapters/index.ts`
- Modify: `src/server/routes/connections.ts`
- Modify: `src/server/routes/schema.ts`
- Delete: `src/server/schema.ts`

- [ ] **Step 1: Add `DbType` to `src/types.ts`**

Replace the `Connection` interface in `src/types.ts`. The full updated file:

```ts
// src/types.ts

export type DbType = 'sqlserver' | 'postgres' | 'sqlite'

export interface Column {
  name: string
  dataType: string
  maxLength: number | null
  numericPrecision: number | null
  numericScale: number | null
  isNullable: boolean
  isPK: boolean
  isFK: boolean
  referencesTable: string | null
  referencesColumn: string | null
}

export interface SchemaTable {
  schema: string
  name: string
  columns: Column[]
}

export interface ForeignKey {
  parentTable: string
  parentColumn: string
  referencedTable: string
  referencedColumn: string
}

export interface SchemaData {
  tables: SchemaTable[]
  foreignKeys: ForeignKey[]
}

export interface Connection {
  name: string
  connectionString: string
  type: DbType
}

export interface Group {
  id: string
  name: string
  color: string
  tables: string[]
}

export interface AppConfig {
  connections: Connection[]
  groups: Group[]
}
```

- [ ] **Step 2: Create `src/server/adapters/index.ts`**

```ts
import type { DbAdapter } from './types'
import type { DbType } from '../../types'
import { sqlServerAdapter } from './sqlserver'
import { postgresAdapter } from './postgres'
import { sqliteAdapter } from './sqlite'

export function getAdapter(type: DbType): DbAdapter {
  switch (type) {
    case 'sqlserver': return sqlServerAdapter
    case 'postgres':  return postgresAdapter
    case 'sqlite':    return sqliteAdapter
  }
}
```

- [ ] **Step 3: Update `src/server/routes/connections.ts`**

Full replacement:

```ts
import { Elysia, t } from 'elysia'
import { readConfig, writeConfig } from '../config'
import { getAdapter } from '../adapters'

const DbTypeSchema = t.Union([
  t.Literal('sqlserver'),
  t.Literal('postgres'),
  t.Literal('sqlite'),
])

export const connectionsRouter = new Elysia({ prefix: '/api/connections' })
  .get('/', () => readConfig().connections)

  .post('/', ({ body, set }) => {
    const config = readConfig()
    if (config.connections.some(c => c.name === body.name)) {
      set.status = 409
      return { error: `Connection "${body.name}" already exists` }
    }
    config.connections.push(body)
    writeConfig(config)
    return body
  }, {
    body: t.Object({
      name: t.String(),
      connectionString: t.String(),
      type: DbTypeSchema,
    })
  })

  .post('/test', async ({ body }) => {
    try {
      await getAdapter(body.type).testConnection(body.connectionString)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }, {
    body: t.Object({
      connectionString: t.String(),
      type: DbTypeSchema,
    })
  })

  .delete('/:name', ({ params }) => {
    const config = readConfig()
    config.connections = config.connections.filter(c => c.name !== params.name)
    writeConfig(config)
    return { ok: true }
  })
```

- [ ] **Step 4: Update `src/server/routes/schema.ts`**

Full replacement (adds `/demo` route; uses `getAdapter`):

```ts
import { Elysia, t } from 'elysia'
import { readConfig } from '../config'
import { getAdapter } from '../adapters'
import { DEMO_SCHEMA } from '../demo-data'

export const schemaRouter = new Elysia({ prefix: '/api/schema' })
  .get('/demo', () => DEMO_SCHEMA)

  .get('/', async ({ query, set }) => {
    const config = readConfig()
    const conn = config.connections.find(c => c.name === query.connection)
    if (!conn) {
      set.status = 404
      return { error: `Connection "${query.connection}" not found` }
    }
    try {
      return await getAdapter(conn.type).fetchSchema(conn.connectionString)
    } catch (err) {
      set.status = 502
      return { error: err instanceof Error ? err.message : String(err) }
    }
  }, {
    query: t.Object({ connection: t.String() })
  })
```

Note: `DEMO_SCHEMA` is imported here but created in Task 5. This file won't compile until Task 5 is done. That's fine — this is committed together with Task 5, or you can create a stub `demo-data.ts` now:

Create `src/server/demo-data.ts` stub (to be replaced in Task 5):
```ts
import type { SchemaData } from '../types'
export const DEMO_SCHEMA: SchemaData = { tables: [], foreignKeys: [] }
```

- [ ] **Step 5: Delete `src/server/schema.ts`**

```bash
rm src/server/schema.ts
```

- [ ] **Step 6: Run all tests**

Run: `bun test`
Expected: 17 pass, 0 fail

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/server/adapters/index.ts src/server/routes/connections.ts src/server/routes/schema.ts src/server/demo-data.ts
git rm src/server/schema.ts
git commit -m "feat: adapter factory, updated routes, DbType in shared types"
```

---

### Task 5: Demo Mode — Data + Backend + Frontend

**Files:**
- Modify: `src/server/demo-data.ts` (replace stub with real data)
- Modify: `src/client/components/Header.tsx`
- Modify: `src/client/App.tsx`

- [ ] **Step 1: Replace the demo-data stub with the full e-commerce schema**

`src/server/demo-data.ts` — 9 tables across 4 schemas (dbo, store, payments, audit):

```ts
import type { SchemaData } from '../types'

export const DEMO_SCHEMA: SchemaData = {
  tables: [
    {
      schema: 'dbo',
      name: 'Customers',
      columns: [
        { name: 'Id', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: true, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'Email', dataType: 'nvarchar', maxLength: 255, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'FirstName', dataType: 'nvarchar', maxLength: 100, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'LastName', dataType: 'nvarchar', maxLength: 100, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'CreatedAt', dataType: 'datetime2', maxLength: null, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
      ],
    },
    {
      schema: 'dbo',
      name: 'Addresses',
      columns: [
        { name: 'Id', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: true, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'CustomerId', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: false, isFK: true, referencesTable: 'Customers', referencesColumn: 'Id' },
        { name: 'Street', dataType: 'nvarchar', maxLength: 200, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'City', dataType: 'nvarchar', maxLength: 100, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'State', dataType: 'nvarchar', maxLength: 50, numericPrecision: null, numericScale: null, isNullable: true, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'PostalCode', dataType: 'nvarchar', maxLength: 20, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'Country', dataType: 'nvarchar', maxLength: 2, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'IsDefault', dataType: 'bit', maxLength: null, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
      ],
    },
    {
      schema: 'store',
      name: 'Categories',
      columns: [
        { name: 'Id', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: true, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'ParentId', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: true, isPK: false, isFK: true, referencesTable: 'Categories', referencesColumn: 'Id' },
        { name: 'Name', dataType: 'nvarchar', maxLength: 150, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'Slug', dataType: 'varchar', maxLength: 150, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'SortOrder', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
      ],
    },
    {
      schema: 'store',
      name: 'Products',
      columns: [
        { name: 'Id', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: true, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'CategoryId', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: false, isFK: true, referencesTable: 'Categories', referencesColumn: 'Id' },
        { name: 'Sku', dataType: 'varchar', maxLength: 80, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'Name', dataType: 'nvarchar', maxLength: 255, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'Price', dataType: 'decimal', maxLength: null, numericPrecision: 10, numericScale: 2, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'StockQty', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'IsActive', dataType: 'bit', maxLength: null, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'CreatedAt', dataType: 'datetime2', maxLength: null, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
      ],
    },
    {
      schema: 'store',
      name: 'Orders',
      columns: [
        { name: 'Id', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: true, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'CustomerId', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: false, isFK: true, referencesTable: 'Customers', referencesColumn: 'Id' },
        { name: 'ShippingAddressId', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: true, isPK: false, isFK: true, referencesTable: 'Addresses', referencesColumn: 'Id' },
        { name: 'Status', dataType: 'nvarchar', maxLength: 50, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'OrderedAt', dataType: 'datetime2', maxLength: null, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'ShippedAt', dataType: 'datetime2', maxLength: null, numericPrecision: null, numericScale: null, isNullable: true, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'TotalAmount', dataType: 'decimal', maxLength: null, numericPrecision: 10, numericScale: 2, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
      ],
    },
    {
      schema: 'store',
      name: 'OrderItems',
      columns: [
        { name: 'Id', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: true, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'OrderId', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: false, isFK: true, referencesTable: 'Orders', referencesColumn: 'Id' },
        { name: 'ProductId', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: false, isFK: true, referencesTable: 'Products', referencesColumn: 'Id' },
        { name: 'Quantity', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'UnitPrice', dataType: 'decimal', maxLength: null, numericPrecision: 10, numericScale: 2, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
      ],
    },
    {
      schema: 'payments',
      name: 'PaymentMethods',
      columns: [
        { name: 'Id', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: true, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'CustomerId', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: false, isFK: true, referencesTable: 'Customers', referencesColumn: 'Id' },
        { name: 'Type', dataType: 'nvarchar', maxLength: 30, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'Last4', dataType: 'char', maxLength: 4, numericPrecision: null, numericScale: null, isNullable: true, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'ExpiryMonth', dataType: 'tinyint', maxLength: null, numericPrecision: 3, numericScale: 0, isNullable: true, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'ExpiryYear', dataType: 'smallint', maxLength: null, numericPrecision: 5, numericScale: 0, isNullable: true, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'IsDefault', dataType: 'bit', maxLength: null, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
      ],
    },
    {
      schema: 'payments',
      name: 'Transactions',
      columns: [
        { name: 'Id', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: true, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'OrderId', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: false, isFK: true, referencesTable: 'Orders', referencesColumn: 'Id' },
        { name: 'PaymentMethodId', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: true, isPK: false, isFK: true, referencesTable: 'PaymentMethods', referencesColumn: 'Id' },
        { name: 'Amount', dataType: 'decimal', maxLength: null, numericPrecision: 10, numericScale: 2, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'Status', dataType: 'nvarchar', maxLength: 30, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'ProcessedAt', dataType: 'datetime2', maxLength: null, numericPrecision: null, numericScale: null, isNullable: true, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'GatewayRef', dataType: 'varchar', maxLength: 200, numericPrecision: null, numericScale: null, isNullable: true, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
      ],
    },
    {
      schema: 'audit',
      name: 'AuditLog',
      columns: [
        { name: 'Id', dataType: 'bigint', maxLength: null, numericPrecision: 19, numericScale: 0, isNullable: false, isPK: true, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'EntityType', dataType: 'varchar', maxLength: 100, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'EntityId', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'Action', dataType: 'varchar', maxLength: 20, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'UserId', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: true, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'ChangedAt', dataType: 'datetime2', maxLength: null, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'Payload', dataType: 'nvarchar', maxLength: -1, numericPrecision: null, numericScale: null, isNullable: true, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
      ],
    },
  ],
  foreignKeys: [
    { parentTable: 'Addresses',      parentColumn: 'CustomerId',       referencedTable: 'Customers',     referencedColumn: 'Id' },
    { parentTable: 'Categories',     parentColumn: 'ParentId',         referencedTable: 'Categories',    referencedColumn: 'Id' },
    { parentTable: 'Products',       parentColumn: 'CategoryId',       referencedTable: 'Categories',    referencedColumn: 'Id' },
    { parentTable: 'Orders',         parentColumn: 'CustomerId',       referencedTable: 'Customers',     referencedColumn: 'Id' },
    { parentTable: 'Orders',         parentColumn: 'ShippingAddressId',referencedTable: 'Addresses',     referencedColumn: 'Id' },
    { parentTable: 'OrderItems',     parentColumn: 'OrderId',          referencedTable: 'Orders',        referencedColumn: 'Id' },
    { parentTable: 'OrderItems',     parentColumn: 'ProductId',        referencedTable: 'Products',      referencedColumn: 'Id' },
    { parentTable: 'PaymentMethods', parentColumn: 'CustomerId',       referencedTable: 'Customers',     referencedColumn: 'Id' },
    { parentTable: 'Transactions',   parentColumn: 'OrderId',          referencedTable: 'Orders',        referencedColumn: 'Id' },
    { parentTable: 'Transactions',   parentColumn: 'PaymentMethodId',  referencedTable: 'PaymentMethods',referencedColumn: 'Id' },
  ],
}
```

- [ ] **Step 2: Update `src/client/components/Header.tsx`**

Add a "Load Demo" button. When `activeConnection === '__demo__'`, the select shows a "Demo Mode" option. Full replacement:

```tsx
import { useState } from 'react'
import { useStore } from '../store'
import { ConnectionModal } from './ConnectionModal'
import type { Connection } from '../../types'

interface HeaderProps {
  connections: Connection[]
  onRefresh: () => void
}

export function Header({ connections, onRefresh }: HeaderProps) {
  const { activeConnection, setActiveConnection } = useStore()
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <header style={{
        height: 54, background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        padding: '0 18px', gap: 14, zIndex: 20, flexShrink: 0,
      }}>
        <span style={{
          fontSize: 14.5, fontWeight: 800, letterSpacing: -0.4,
          background: 'var(--accent-grad)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          schemaboard
        </span>

        <div style={{ width: 1, height: 18, background: 'var(--border-strong)', flexShrink: 0 }} />

        <select
          value={activeConnection ?? ''}
          onChange={e => setActiveConnection(e.target.value)}
          style={{
            padding: '5px 11px',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--r-sm)',
            cursor: 'pointer', fontSize: 13, fontWeight: 500,
            color: activeConnection ? 'var(--text-1)' : 'var(--text-3)',
            background: 'var(--bg)', fontFamily: 'inherit', outline: 'none',
          }}
        >
          <option value="" disabled>Select connection…</option>
          <option value="__demo__" style={{ color: 'var(--sel)' }}>Demo Mode</option>
          {connections.map(c => (
            <option key={c.name} value={c.name}>{c.name}</option>
          ))}
        </select>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setActiveConnection('__demo__')}
            style={{
              padding: '7px 13px', background: 'transparent',
              border: '1px solid var(--sel)',
              borderRadius: 'var(--r-sm)',
              color: 'var(--sel)',
              cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, fontWeight: 600,
              opacity: activeConnection === '__demo__' ? 0.5 : 1,
            }}
          >
            Load Demo
          </button>
          <button
            onClick={onRefresh}
            style={{
              padding: '7px 13px', background: 'transparent', border: 'none',
              color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, fontWeight: 600, borderRadius: 'var(--r-sm)',
            }}
          >
            Refresh
          </button>
          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: '7px 13px', background: 'transparent',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--r-sm)', color: 'var(--text-1)',
              cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, fontWeight: 600,
            }}
          >
            Manage Connections
          </button>
        </div>
      </header>

      {showModal && (
        <ConnectionModal
          connections={connections}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 3: Update `src/client/App.tsx` schema query**

Only change the `queryFn` of the schema query (lines 38-46 of the original). Find this block in App.tsx:

```ts
  const { data: schemaData = EMPTY_SCHEMA, refetch } = useQuery({
    queryKey: ['schema', activeConnection],
    enabled: !!activeConnection,
    queryFn: async () => {
      const res = await api.api.schema.get({ query: { connection: activeConnection! } })
      if (res.error) throw res.error
      return (res.data as SchemaData) ?? EMPTY_SCHEMA
    }
  })
```

Replace it with:

```ts
  const { data: schemaData = EMPTY_SCHEMA, refetch } = useQuery({
    queryKey: ['schema', activeConnection],
    enabled: !!activeConnection,
    queryFn: async () => {
      if (activeConnection === '__demo__') {
        const res = await api.api.schema.demo.get()
        if (res.error) throw res.error
        return (res.data as SchemaData) ?? EMPTY_SCHEMA
      }
      const res = await api.api.schema.get({ query: { connection: activeConnection! } })
      if (res.error) throw res.error
      return (res.data as SchemaData) ?? EMPTY_SCHEMA
    }
  })
```

- [ ] **Step 4: Run all tests**

Run: `bun test`
Expected: 17 pass, 0 fail

- [ ] **Step 5: Run Vite build to check for TypeScript errors**

Run: `bun run build`
Expected: `✓ built in X.XXs` — 0 errors

- [ ] **Step 6: Commit**

```bash
git add src/server/demo-data.ts src/client/components/Header.tsx src/client/App.tsx
git commit -m "feat: demo mode — DEMO_SCHEMA endpoint, Load Demo button, __demo__ sentinel"
```

---

### Task 6: ConnectionModal — DB Type Selector

This updates the connection modal to show a segmented control for DB type and pass `type` through the API calls. The connection string placeholder text also changes per type to guide the user.

**Files:**
- Modify: `src/client/components/ConnectionModal.tsx`

- [ ] **Step 1: Write the updated ConnectionModal**

Full replacement of `src/client/components/ConnectionModal.tsx`:

```tsx
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Connection, DbType } from '../../types'

interface ConnectionModalProps {
  connections: Connection[]
  onClose: () => void
}

const DB_TYPE_LABELS: Record<DbType, string> = {
  sqlserver: 'SQL Server',
  postgres: 'Postgres',
  sqlite: 'SQLite',
}

const CONN_STR_PLACEHOLDER: Record<DbType, string> = {
  sqlserver: 'Server=localhost;Database=mydb;User Id=sa;Password=...',
  postgres: 'postgresql://user:password@localhost:5432/mydb',
  sqlite: '/path/to/database.db',
}

export function ConnectionModal({ connections, onClose }: ConnectionModalProps) {
  const [name, setName] = useState('')
  const [connStr, setConnStr] = useState('')
  const [dbType, setDbType] = useState<DbType>('sqlserver')
  const [testResult, setTestResult] = useState<'idle' | 'ok' | 'error'>('idle')
  const [testError, setTestError] = useState('')
  const qc = useQueryClient()

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await api.api.connections.post({ name, connectionString: connStr, type: dbType })
      if (res.error) throw new Error((res.error as { value?: { error?: string } }).value?.error ?? 'Failed to add connection')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['connections'] })
      setName('')
      setConnStr('')
      setDbType('sqlserver')
      setTestResult('idle')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (connName: string) => {
      const encoded = encodeURIComponent(connName)
      const res = await api.api.connections({ name: encoded }).delete()
      if (res.error) throw res.error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['connections'] })
  })

  const handleTest = async () => {
    setTestResult('idle')
    setTestError('')
    try {
      const res = await api.api.connections.test.post({ connectionString: connStr, type: dbType })
      if (res.error || (res.data as { ok: boolean }).ok === false) {
        setTestResult('error')
        setTestError((res.data as { error?: string })?.error ?? 'Connection failed')
      } else {
        setTestResult('ok')
      }
    } catch (err) {
      setTestResult('error')
      setTestError(err instanceof Error ? err.message : 'Connection failed')
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)', borderRadius: 'var(--r)',
          border: '1px solid var(--border)', padding: 24, width: 460,
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: 'var(--text-1)' }}>
          Manage Connections
        </h2>

        {connections.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16 }}>
            No connections yet. Add one below.
          </p>
        )}

        {connections.map(c => (
          <div key={c.name} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 0', borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ok-color)', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{c.name}</span>
            <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>{DB_TYPE_LABELS[c.type]}</span>
            <button
              onClick={() => deleteMutation.mutate(c.name)}
              style={{
                background: 'none', border: 'none', color: 'var(--text-3)',
                cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
              }}
            >
              Remove
            </button>
          </div>
        ))}

        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* DB Type segmented control */}
          <div style={{
            display: 'flex', gap: 2,
            background: 'var(--bg)', borderRadius: 'var(--r-sm)',
            border: '1px solid var(--border-strong)', padding: 3,
          }}>
            {(['sqlserver', 'postgres', 'sqlite'] as DbType[]).map(t => (
              <button
                key={t}
                onClick={() => { setDbType(t); setTestResult('idle') }}
                style={{
                  flex: 1, padding: '5px 8px',
                  borderRadius: 5, border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                  background: dbType === t ? 'var(--surface)' : 'transparent',
                  color: dbType === t ? 'var(--text-1)' : 'var(--text-3)',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {DB_TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Connection name (e.g. Local Dev)"
            style={inputStyle}
          />
          <input
            value={connStr}
            onChange={e => { setConnStr(e.target.value); setTestResult('idle') }}
            placeholder={CONN_STR_PLACEHOLDER[dbType]}
            style={inputStyle}
          />
          {testResult === 'error' && testError && (
            <div style={{ fontSize: 12, color: 'var(--err-color)', padding: '6px 10px', background: 'var(--err-bg)', borderRadius: 6 }}>
              {testError}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleTest}
              disabled={!connStr}
              style={{
                padding: '8px 14px', borderRadius: 'var(--r-sm)',
                border: '1px solid var(--border-strong)',
                background: 'var(--bg)', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                cursor: connStr ? 'pointer' : 'not-allowed',
                color: testResult === 'ok' ? 'var(--ok-color)' : testResult === 'error' ? 'var(--err-color)' : 'var(--text-2)',
              }}
            >
              {testResult === 'ok' ? '✓ Connected' : testResult === 'error' ? '✗ Failed' : 'Test'}
            </button>
            <button
              onClick={() => addMutation.mutate()}
              disabled={!name || !connStr || addMutation.isPending}
              style={{
                flex: 1, padding: '8px 14px', borderRadius: 'var(--r-sm)',
                background: name && connStr ? 'var(--accent-grad)' : 'rgba(255,255,255,0.1)',
                border: 'none', color: 'white', cursor: name && connStr ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
              }}
            >
              {addMutation.isPending ? 'Adding…' : 'Add Connection'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  background: 'var(--bg)',
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--r-sm)',
  color: 'var(--text-1)',
  fontFamily: 'inherit',
  fontSize: 13,
  outline: 'none',
  width: '100%',
}
```

- [ ] **Step 2: Run all tests**

Run: `bun test`
Expected: 17 pass, 0 fail

- [ ] **Step 3: Run Vite build**

Run: `bun run build`
Expected: `✓ built in X.XXs` — 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/client/components/ConnectionModal.tsx
git commit -m "feat: DB type selector in connection modal (SQL Server, Postgres, SQLite)"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Demo mode: `GET /api/schema/demo`, hardcoded DEMO_SCHEMA, "Load Demo" button in Header, App handles `__demo__`
- ✅ `Connection.type: DbType` added to shared types
- ✅ Adapter pattern: `DbAdapter` interface, `getAdapter` factory, 3 implementations
- ✅ SQL Server adapter: logic moved from schema.ts, same queries
- ✅ Postgres adapter: `pg` package, INFORMATION_SCHEMA adapted for Postgres
- ✅ SQLite adapter: `bun:sqlite` PRAGMA queries, no extra package
- ✅ Routes updated: both connections and schema routes use adapters
- ✅ ConnectionModal: type field in form, segmented control, placeholder text per type, type shown in connection list
- ✅ No migration needed: schema.ts deleted, Connection type field is additive

**Placeholder scan:** No TBDs, no "add appropriate" language, all code blocks are complete.

**Type consistency:**
- `DbType` defined in `src/types.ts`, re-exported from `adapters/types.ts` — used consistently throughout
- `DbAdapter.testConnection` / `DbAdapter.fetchSchema` signatures match in interface and all 3 implementations
- `getAdapter(type: DbType)` matches `conn.type: DbType` used in routes
- `api.api.connections.test.post({ connectionString, type })` in modal matches route body schema `{ connectionString, type: DbTypeSchema }`
- `api.api.schema.demo.get()` in App.tsx matches the `.get('/demo', ...)` route in schema router
