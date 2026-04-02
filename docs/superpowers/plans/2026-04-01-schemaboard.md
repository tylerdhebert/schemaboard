# Schemaboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local developer tool that connects to SQL Server, renders an interactive ERD, and exports token-friendly context blocks for AI agent prompts.

**Architecture:** Bun + Elysia backend serves schema data queried live from SQL Server and persists connection strings + group definitions in a local JSON config file. React + React Flow frontend renders the ERD with custom nodes, drives multi-table selection, and generates condensed or DDL-format context output. No database — schema is always fetched fresh.

**Tech Stack:** Bun, Elysia, `mssql`, Eden Treaty, React 19, Vite, Tailwind v4, `@xyflow/react`, `@dagrejs/dagre`, Zustand, TanStack Query v5

---

## File Map

```
schemaboard/
  src/
    types.ts                          # shared types: Column, SchemaTable, ForeignKey, Connection, Group, AppConfig
    server/
      index.ts                        # Elysia app, mounts routers, exports App type
      config.ts                       # read/write schemaboard.config.json
      schema.ts                       # SQL Server queries: tables, columns, PKs, FKs
      routes/
        connections.ts                # CRUD /connections
        groups.ts                     # CRUD /groups
        schema.ts                     # GET /schema?connection=<name>
    client/
      main.tsx                        # React entry point
      App.tsx                         # root layout: Header + Sidebar + Canvas + ContextPanel
      store.ts                        # Zustand: selected tables, format, autoExpand, activeConnection
      api/
        client.ts                     # Eden Treaty client (never use bare fetch)
      components/
        Header.tsx                    # logo, connection selector, refresh, add connection
        Sidebar.tsx                   # groups list + table list, visibility toggles
        Canvas.tsx                    # React Flow canvas, dagre layout, FK edges
        TableNode.tsx                 # custom React Flow node: group bar, PK/FK badges, columns
        ContextPanel.tsx              # format switcher, auto-expand toggle, preview, token count, copy
        ConnectionModal.tsx           # add/edit/delete named connections
        GroupModal.tsx                # add/edit/delete groups, assign color
      lib/
        context-generator.ts          # condensed + DDL format generators
        token-estimate.ts             # rough token count (~4 chars/token)
        layout.ts                     # dagre layout: SchemaTable[] → React Flow nodes + edges
  index.html
  vite.config.ts
  tsconfig.json
  package.json
  schemaboard.config.example.json
  .gitignore
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `.gitignore`
- Create: `schemaboard.config.example.json`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "schemaboard",
  "version": "0.1.0",
  "scripts": {
    "dev:server": "bun --watch src/server/index.ts",
    "dev:client": "vite",
    "dev": "concurrently \"bun run dev:server\" \"bun run dev:client\"",
    "build": "vite build",
    "test": "bun test"
  },
  "dependencies": {
    "@elysiajs/eden": "^1.2.0",
    "@dagrejs/dagre": "^1.1.4",
    "@tanstack/react-query": "^5.62.0",
    "@xyflow/react": "^12.3.6",
    "elysia": "^1.2.0",
    "mssql": "^11.0.1",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zustand": "^5.0.3"
  },
  "devDependencies": {
    "@types/mssql": "^9.1.5",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    "bun-types": "latest",
    "concurrently": "^9.1.2",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "types": ["bun-types"],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create vite.config.ts**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: { proxy: { '/api': 'http://localhost:3777' } }
})
```

- [ ] **Step 4: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>schemaboard</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/client/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create .gitignore**

```
node_modules/
dist/
schemaboard.config.json
```

- [ ] **Step 6: Create schemaboard.config.example.json**

```json
{
  "connections": [
    {
      "name": "Local Dev",
      "connectionString": "Server=localhost;Database=MyDb;User Id=sa;Password=yourpassword;TrustServerCertificate=true"
    }
  ],
  "groups": [
    {
      "id": "g1",
      "name": "Orders",
      "color": "#3B82F6",
      "tables": ["Orders", "OrderItems"]
    }
  ]
}
```

- [ ] **Step 7: Install dependencies**

```bash
bun install
```

- [ ] **Step 8: Commit**

```bash
git init
git add .
git commit -m "chore: scaffold schemaboard project"
```

---

## Task 2: Shared Types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Write types**

```ts
// src/types.ts

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
}

export interface Group {
  id: string
  name: string
  color: string
  tables: string[]   // table names (unqualified)
}

export interface AppConfig {
  connections: Connection[]
  groups: Group[]
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add shared types"
```

---

## Task 3: Config Module

**Files:**
- Create: `src/server/config.ts`
- Create: `src/server/config.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/server/config.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { readConfig, writeConfig, CONFIG_PATH } from './config'
import { unlinkSync, existsSync } from 'fs'

const TEST_PATH = './test-schemaboard.config.json'

// Override config path for tests
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
      connections: [{ name: 'Test', connectionString: 'Server=test' }],
      groups: [{ id: 'g1', name: 'Orders', color: '#3B82F6', tables: ['Orders'] }]
    }
    writeConfig(data)
    const read = readConfig()
    expect(read.connections[0].name).toBe('Test')
    expect(read.groups[0].name).toBe('Orders')
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
bun test src/server/config.test.ts
```

Expected: `Cannot find module './config'`

- [ ] **Step 3: Implement config module**

```ts
// src/server/config.ts
import { readFileSync, writeFileSync, existsSync } from 'fs'
import type { AppConfig } from '../types'

export const CONFIG_PATH = process.env.SCHEMABOARD_CONFIG_PATH ?? './schemaboard.config.json'

const DEFAULTS: AppConfig = { connections: [], groups: [] }

export function readConfig(): AppConfig {
  if (!existsSync(CONFIG_PATH)) return { ...DEFAULTS }
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as AppConfig
  } catch {
    return { ...DEFAULTS }
  }
}

export function writeConfig(config: AppConfig): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
bun test src/server/config.test.ts
```

Expected: `2 pass, 0 fail`

- [ ] **Step 5: Commit**

```bash
git add src/server/config.ts src/server/config.test.ts
git commit -m "feat: add config read/write module"
```

---

## Task 4: Schema Query Module

**Files:**
- Create: `src/server/schema.ts`
- Create: `src/server/schema.test.ts`

- [ ] **Step 1: Write failing test for query builder (no DB required)**

```ts
// src/server/schema.test.ts
import { describe, test, expect } from 'bun:test'
import { buildSchemaData } from './schema'
import type { SchemaData } from '../types'

describe('buildSchemaData', () => {
  test('merges raw rows into structured SchemaData', () => {
    const rawColumns = [
      { schema: 'dbo', tableName: 'Orders', columnName: 'Id', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: 'NO', defaultValue: null },
      { schema: 'dbo', tableName: 'Orders', columnName: 'CustomerId', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: 'NO', defaultValue: null },
    ]
    const rawPKs = [
      { schema: 'dbo', tableName: 'Orders', columnName: 'Id' }
    ]
    const rawFKs = [
      { parentTable: 'Orders', parentColumn: 'CustomerId', referencedTable: 'Customers', referencedColumn: 'Id' }
    ]

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

- [ ] **Step 2: Run test — expect FAIL**

```bash
bun test src/server/schema.test.ts
```

Expected: `Cannot find module './schema'`

- [ ] **Step 3: Implement schema module**

```ts
// src/server/schema.ts
import sql from 'mssql'
import type { SchemaData, SchemaTable, Column, ForeignKey } from '../types'

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
  tp.name AS parentTable,
  cp.name AS parentColumn,
  tr.name AS referencedTable,
  cr.name AS referencedColumn
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
JOIN sys.tables tp ON fkc.parent_object_id = tp.object_id
JOIN sys.columns cp
  ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id
JOIN sys.columns cr
  ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
`

type RawColumn = {
  schema: string; tableName: string; columnName: string
  dataType: string; maxLength: number | null
  numericPrecision: number | null; numericScale: number | null
  isNullable: string; defaultValue: string | null
}
type RawPK = { schema: string; tableName: string; columnName: string }
type RawFK = { parentTable: string; parentColumn: string; referencedTable: string; referencedColumn: string }

export function buildSchemaData(
  rawColumns: RawColumn[],
  rawPKs: RawPK[],
  rawFKs: RawFK[]
): SchemaData {
  const pkSet = new Set(rawPKs.map(pk => `${pk.tableName}.${pk.columnName}`))
  const fkMap = new Map(rawFKs.map(fk => [
    `${fk.parentTable}.${fk.parentColumn}`,
    { referencesTable: fk.referencedTable, referencesColumn: fk.referencedColumn }
  ]))

  const tableMap = new Map<string, SchemaTable>()

  for (const row of rawColumns) {
    const key = `${row.schema}.${row.tableName}`
    if (!tableMap.has(key)) {
      tableMap.set(key, { schema: row.schema, name: row.tableName, columns: [] })
    }
    const fkInfo = fkMap.get(`${row.tableName}.${row.columnName}`)
    const column: Column = {
      name: row.columnName,
      dataType: row.dataType,
      maxLength: row.maxLength,
      numericPrecision: row.numericPrecision,
      numericScale: row.numericScale,
      isNullable: row.isNullable === 'YES',
      isPK: pkSet.has(`${row.tableName}.${row.columnName}`),
      isFK: !!fkInfo,
      referencesTable: fkInfo?.referencesTable ?? null,
      referencesColumn: fkInfo?.referencesColumn ?? null,
    }
    tableMap.get(key)!.columns.push(column)
  }

  return {
    tables: Array.from(tableMap.values()),
    foreignKeys: rawFKs
  }
}

export async function fetchSchema(connectionString: string): Promise<SchemaData> {
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
}

export async function testConnection(connectionString: string): Promise<void> {
  const pool = await sql.connect(connectionString)
  await pool.close()
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
bun test src/server/schema.test.ts
```

Expected: `1 pass, 0 fail`

- [ ] **Step 5: Commit**

```bash
git add src/server/schema.ts src/server/schema.test.ts
git commit -m "feat: add SQL Server schema query module"
```

---

## Task 5: Backend Routes + Elysia App

**Files:**
- Create: `src/server/routes/connections.ts`
- Create: `src/server/routes/groups.ts`
- Create: `src/server/routes/schema.ts`
- Create: `src/server/index.ts`

- [ ] **Step 1: Create connections router**

```ts
// src/server/routes/connections.ts
import { Elysia, t } from 'elysia'
import { readConfig, writeConfig } from '../config'
import { testConnection } from '../schema'

export const connectionsRouter = new Elysia({ prefix: '/api/connections' })
  .get('/', () => readConfig().connections)

  .post('/', ({ body }) => {
    const config = readConfig()
    config.connections.push(body)
    writeConfig(config)
    return body
  }, {
    body: t.Object({
      name: t.String(),
      connectionString: t.String()
    })
  })

  .post('/test', async ({ body }) => {
    await testConnection(body.connectionString)
    return { ok: true }
  }, {
    body: t.Object({ connectionString: t.String() })
  })

  .delete('/:name', ({ params }) => {
    const config = readConfig()
    config.connections = config.connections.filter(c => c.name !== params.name)
    writeConfig(config)
    return { ok: true }
  })
```

- [ ] **Step 2: Create groups router**

```ts
// src/server/routes/groups.ts
import { Elysia, t } from 'elysia'
import { readConfig, writeConfig } from '../config'
import { randomUUID } from 'crypto'

export const groupsRouter = new Elysia({ prefix: '/api/groups' })
  .get('/', () => readConfig().groups)

  .post('/', ({ body }) => {
    const config = readConfig()
    const group = { ...body, id: randomUUID() }
    config.groups.push(group)
    writeConfig(config)
    return group
  }, {
    body: t.Object({
      name: t.String(),
      color: t.String(),
      tables: t.Array(t.String())
    })
  })

  .put('/:id', ({ params, body }) => {
    const config = readConfig()
    const idx = config.groups.findIndex(g => g.id === params.id)
    if (idx === -1) throw new Error('Group not found')
    config.groups[idx] = { ...config.groups[idx], ...body }
    writeConfig(config)
    return config.groups[idx]
  }, {
    body: t.Object({
      name: t.Optional(t.String()),
      color: t.Optional(t.String()),
      tables: t.Optional(t.Array(t.String()))
    })
  })

  .delete('/:id', ({ params }) => {
    const config = readConfig()
    config.groups = config.groups.filter(g => g.id !== params.id)
    writeConfig(config)
    return { ok: true }
  })
```

- [ ] **Step 3: Create schema router**

```ts
// src/server/routes/schema.ts
import { Elysia, t } from 'elysia'
import { readConfig } from '../config'
import { fetchSchema } from '../schema'

export const schemaRouter = new Elysia({ prefix: '/api/schema' })
  .get('/', async ({ query }) => {
    const config = readConfig()
    const conn = config.connections.find(c => c.name === query.connection)
    if (!conn) throw new Error(`Connection "${query.connection}" not found`)
    return fetchSchema(conn.connectionString)
  }, {
    query: t.Object({ connection: t.String() })
  })
```

- [ ] **Step 4: Create server entry point**

```ts
// src/server/index.ts
import { Elysia } from 'elysia'
import { connectionsRouter } from './routes/connections'
import { groupsRouter } from './routes/groups'
import { schemaRouter } from './routes/schema'

const app = new Elysia()
  .use(connectionsRouter)
  .use(groupsRouter)
  .use(schemaRouter)
  .listen(3777)

console.log('schemaboard server running on http://localhost:3777')

export type App = typeof app
```

- [ ] **Step 5: Smoke test the server**

```bash
bun run src/server/index.ts
```

Expected: `schemaboard server running on http://localhost:3777`

- [ ] **Step 6: Commit**

```bash
git add src/server/
git commit -m "feat: add Elysia backend with connections, groups, schema routes"
```

---

## Task 6: Context Generator + Token Estimator

**Files:**
- Create: `src/client/lib/context-generator.ts`
- Create: `src/client/lib/context-generator.test.ts`
- Create: `src/client/lib/token-estimate.ts`
- Create: `src/client/lib/token-estimate.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/client/lib/context-generator.test.ts
import { describe, test, expect } from 'bun:test'
import { generateCondensed, generateDDL } from './context-generator'
import type { SchemaTable, ForeignKey } from '../../types'

const tables: SchemaTable[] = [{
  schema: 'dbo',
  name: 'Orders',
  columns: [
    { name: 'Id', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: true, isFK: false, referencesTable: null, referencesColumn: null },
    { name: 'CustomerId', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: false, isFK: true, referencesTable: 'Customers', referencesColumn: 'Id' },
    { name: 'Total', dataType: 'decimal', maxLength: null, numericPrecision: 10, numericScale: 2, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
    { name: 'Notes', dataType: 'nvarchar', maxLength: 500, numericPrecision: null, numericScale: null, isNullable: true, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
  ]
}]

const fks: ForeignKey[] = [{
  parentTable: 'Orders', parentColumn: 'CustomerId',
  referencedTable: 'Customers', referencedColumn: 'Id'
}]

describe('generateCondensed', () => {
  test('formats table with PK, FK, nullable, type annotations', () => {
    const result = generateCondensed(tables, fks)
    expect(result).toContain('Orders')
    expect(result).toContain('Id PK')
    expect(result).toContain('CustomerId FK→Customers')
    expect(result).toContain('Notes? nvarchar(500)')
    expect(result).toContain('decimal(10,2)')
  })

  test('includes relationship section when FKs exist', () => {
    const result = generateCondensed(tables, fks)
    expect(result).toContain('Relationships:')
    expect(result).toContain('Orders.CustomerId → Customers.Id')
  })
})

describe('generateDDL', () => {
  test('generates CREATE TABLE with correct types and constraints', () => {
    const result = generateDDL(tables, fks)
    expect(result).toContain('CREATE TABLE dbo.Orders')
    expect(result).toContain('Id int NOT NULL PRIMARY KEY')
    expect(result).toContain('CustomerId int NOT NULL REFERENCES dbo.Customers(Id)')
    expect(result).toContain('Notes nvarchar(500) NULL')
    expect(result).toContain('Total decimal(10,2) NOT NULL')
  })
})
```

```ts
// src/client/lib/token-estimate.test.ts
import { describe, test, expect } from 'bun:test'
import { estimateTokens } from './token-estimate'

describe('estimateTokens', () => {
  test('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0)
  })
  test('estimates ~1 token per 4 chars', () => {
    expect(estimateTokens('abcdefgh')).toBe(2)
  })
  test('rounds up', () => {
    expect(estimateTokens('abc')).toBe(1)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
bun test src/client/lib/
```

Expected: `Cannot find module`

- [ ] **Step 3: Implement token estimator**

```ts
// src/client/lib/token-estimate.ts
export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}
```

- [ ] **Step 4: Implement context generator**

```ts
// src/client/lib/context-generator.ts
import type { SchemaTable, ForeignKey, Column } from '../../types'

function formatType(col: Column): string {
  if (col.dataType === 'nvarchar' || col.dataType === 'varchar' || col.dataType === 'char') {
    const len = col.maxLength === -1 ? 'max' : col.maxLength
    return `${col.dataType}(${len})`
  }
  if (col.dataType === 'decimal' || col.dataType === 'numeric') {
    return `${col.dataType}(${col.numericPrecision},${col.numericScale})`
  }
  return col.dataType
}

export function generateCondensed(tables: SchemaTable[], foreignKeys: ForeignKey[]): string {
  const relevantTableNames = new Set(tables.map(t => t.name))
  const relevantFKs = foreignKeys.filter(
    fk => relevantTableNames.has(fk.parentTable) && relevantTableNames.has(fk.referencedTable)
  )

  const tableLines = tables.map(table => {
    const cols = table.columns.map(col => {
      const type = formatType(col)
      const nullable = col.isNullable ? '?' : ''
      if (col.isPK) return `${col.name} PK`
      if (col.isFK) return `${col.name} FK→${col.referencesTable}`
      return `${col.name}${nullable} ${type}`
    })
    return `${table.name} (${cols.join(', ')})`
  })

  const lines = tableLines.join('\n\n')
  if (relevantFKs.length === 0) return lines

  const relLines = relevantFKs.map(
    fk => `- ${fk.parentTable}.${fk.parentColumn} → ${fk.referencedTable}.${fk.referencedColumn}`
  )
  return `${lines}\n\nRelationships:\n${relLines.join('\n')}`
}

export function generateDDL(tables: SchemaTable[], foreignKeys: ForeignKey[]): string {
  const fkMap = new Map(
    foreignKeys.map(fk => [`${fk.parentTable}.${fk.parentColumn}`, fk])
  )

  return tables.map(table => {
    const colDefs = table.columns.map(col => {
      const type = formatType(col)
      const nullable = col.isNullable ? 'NULL' : 'NOT NULL'
      const pk = col.isPK ? ' PRIMARY KEY' : ''
      const fk = fkMap.get(`${table.name}.${col.name}`)
      const ref = fk ? ` REFERENCES dbo.${fk.referencedTable}(${fk.referencedColumn})` : ''
      return `  ${col.name} ${type} ${nullable}${pk}${ref}`
    })
    return `CREATE TABLE ${table.schema}.${table.name} (\n${colDefs.join(',\n')}\n)`
  }).join('\n\n')
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
bun test src/client/lib/
```

Expected: `6 pass, 0 fail`

- [ ] **Step 6: Commit**

```bash
git add src/client/lib/
git commit -m "feat: add context generator and token estimator"
```

---

## Task 7: Layout Helper

**Files:**
- Create: `src/client/lib/layout.ts`
- Create: `src/client/lib/layout.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/client/lib/layout.test.ts
import { describe, test, expect } from 'bun:test'
import { buildLayout } from './layout'
import type { SchemaTable, ForeignKey } from '../../types'

const tables: SchemaTable[] = [
  { schema: 'dbo', name: 'Orders', columns: [] },
  { schema: 'dbo', name: 'Customers', columns: [] },
]
const fks: ForeignKey[] = [
  { parentTable: 'Orders', parentColumn: 'CustomerId', referencedTable: 'Customers', referencedColumn: 'Id' }
]

describe('buildLayout', () => {
  test('returns one node per table', () => {
    const { nodes } = buildLayout(tables, fks)
    expect(nodes).toHaveLength(2)
    expect(nodes.map(n => n.id)).toContain('dbo.Orders')
  })

  test('returns one edge per FK', () => {
    const { edges } = buildLayout(tables, fks)
    expect(edges).toHaveLength(1)
    expect(edges[0].source).toBe('dbo.Orders')
    expect(edges[0].target).toBe('dbo.Customers')
  })

  test('nodes have position set by dagre', () => {
    const { nodes } = buildLayout(tables, fks)
    expect(nodes[0].position.x).toBeGreaterThanOrEqual(0)
    expect(nodes[0].position.y).toBeGreaterThanOrEqual(0)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
bun test src/client/lib/layout.test.ts
```

Expected: `Cannot find module './layout'`

- [ ] **Step 3: Implement layout helper**

```ts
// src/client/lib/layout.ts
import dagre from '@dagrejs/dagre'
import type { Node, Edge } from '@xyflow/react'
import type { SchemaTable, ForeignKey } from '../../types'

const NODE_WIDTH = 220
const NODE_HEIGHT_BASE = 44   // header
const ROW_HEIGHT = 24          // per column row

export function buildLayout(
  tables: SchemaTable[],
  foreignKeys: ForeignKey[]
): { nodes: Node[]; edges: Edge[] } {
  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({ rankdir: 'LR', ranksep: 80, nodesep: 40 })

  for (const table of tables) {
    const height = NODE_HEIGHT_BASE + table.columns.length * ROW_HEIGHT + 16
    graph.setNode(`${table.schema}.${table.name}`, { width: NODE_WIDTH, height })
  }

  const tableNames = new Set(tables.map(t => t.name))
  for (const fk of foreignKeys) {
    if (!tableNames.has(fk.parentTable) || !tableNames.has(fk.referencedTable)) continue
    // find schema for each table
    const parentTable = tables.find(t => t.name === fk.parentTable)!
    const refTable = tables.find(t => t.name === fk.referencedTable)!
    graph.setEdge(
      `${parentTable.schema}.${parentTable.name}`,
      `${refTable.schema}.${refTable.name}`
    )
  }

  dagre.layout(graph)

  const nodes: Node[] = tables.map(table => {
    const nodeId = `${table.schema}.${table.name}`
    const pos = graph.node(nodeId)
    return {
      id: nodeId,
      type: 'tableNode',
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - pos.height / 2 },
      data: { table }
    }
  })

  const seenEdges = new Set<string>()
  const edges: Edge[] = []

  for (const fk of foreignKeys) {
    if (!tableNames.has(fk.parentTable) || !tableNames.has(fk.referencedTable)) continue
    const parentTable = tables.find(t => t.name === fk.parentTable)!
    const refTable = tables.find(t => t.name === fk.referencedTable)!
    const edgeId = `${parentTable.schema}.${parentTable.name}->${refTable.schema}.${refTable.name}-${fk.parentColumn}`
    if (seenEdges.has(edgeId)) continue
    seenEdges.add(edgeId)
    edges.push({
      id: edgeId,
      source: `${parentTable.schema}.${parentTable.name}`,
      target: `${refTable.schema}.${refTable.name}`,
      label: fk.parentColumn,
      type: 'smoothstep',
      style: { strokeDasharray: '5 3' }
    })
  }

  return { nodes, edges }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
bun test src/client/lib/layout.test.ts
```

Expected: `3 pass, 0 fail`

- [ ] **Step 5: Commit**

```bash
git add src/client/lib/layout.ts src/client/lib/layout.test.ts
git commit -m "feat: add dagre layout helper"
```

---

## Task 8: Frontend Scaffold + Eden Client + Store

**Files:**
- Create: `src/client/api/client.ts`
- Create: `src/client/store.ts`
- Create: `src/client/main.tsx`

- [ ] **Step 1: Create Eden Treaty client**

```ts
// src/client/api/client.ts
import { treaty } from '@elysiajs/eden'
import type { App } from '../../server/index'

export const api = treaty<App>('localhost:3777')
```

- [ ] **Step 2: Create Zustand store**

```ts
// src/client/store.ts
import { create } from 'zustand'

interface AppState {
  activeConnection: string | null
  selectedTables: Set<string>        // "schema.tableName"
  hiddenGroups: Set<string>          // group ids
  autoExpand: boolean
  format: 'condensed' | 'ddl'
  setActiveConnection: (name: string) => void
  toggleTable: (id: string) => void
  selectTables: (ids: string[]) => void
  clearSelection: () => void
  toggleGroupVisibility: (groupId: string) => void
  setAutoExpand: (v: boolean) => void
  setFormat: (f: 'condensed' | 'ddl') => void
}

export const useStore = create<AppState>((set) => ({
  activeConnection: null,
  selectedTables: new Set(),
  hiddenGroups: new Set(),
  autoExpand: true,
  format: 'condensed',

  setActiveConnection: (name) => set({ activeConnection: name, selectedTables: new Set() }),

  toggleTable: (id) => set((s) => {
    const next = new Set(s.selectedTables)
    next.has(id) ? next.delete(id) : next.add(id)
    return { selectedTables: next }
  }),

  selectTables: (ids) => set((s) => {
    const next = new Set(s.selectedTables)
    ids.forEach(id => next.add(id))
    return { selectedTables: next }
  }),

  clearSelection: () => set({ selectedTables: new Set() }),

  toggleGroupVisibility: (groupId) => set((s) => {
    const next = new Set(s.hiddenGroups)
    next.has(groupId) ? next.delete(groupId) : next.add(groupId)
    return { hiddenGroups: next }
  }),

  setAutoExpand: (autoExpand) => set({ autoExpand }),
  setFormat: (format) => set({ format }),
}))
```

- [ ] **Step 3: Create main.tsx**

```tsx
// src/client/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from './App'
import './index.css'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
)
```

- [ ] **Step 4: Create index.css with design system**

```css
/* src/client/index.css */
@import "tailwindcss";

@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');

:root {
  --bg:            #24201A;
  --surface:       #332E25;
  --border:        rgba(255,255,255,0.07);
  --border-strong: rgba(255,255,255,0.12);
  --text-1:        #EDE6DA;
  --text-2:        #8C8278;
  --text-3:        #5E584F;
  --accent:        #4A7BF5;
  --accent-light:  rgba(74,123,245,0.15);
  --accent-grad:   linear-gradient(135deg, #4A7BF5 0%, #22C2C8 100%);
  --sel:           #F59E0B;
  --sel-light:     rgba(245,158,11,0.12);
  --sel-ring:      rgba(245,158,11,0.22);
  --canvas:        #1A1712;
  --shadow-md:     0 4px 16px rgba(0,0,0,0.4), 0 2px 6px rgba(0,0,0,0.25);
  --shadow-lg:     0 12px 40px rgba(0,0,0,0.55), 0 4px 12px rgba(0,0,0,0.35);
  --r:             12px;
  --r-sm:          8px;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Plus Jakarta Sans', sans-serif;
  background: var(--bg);
  color: var(--text-1);
  -webkit-font-smoothing: antialiased;
}

::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
```

- [ ] **Step 5: Commit**

```bash
git add src/client/
git commit -m "feat: add Eden client, Zustand store, and frontend scaffold"
```

---

## Task 9: TableNode Component

**Files:**
- Create: `src/client/components/TableNode.tsx`

- [ ] **Step 1: Implement TableNode**

```tsx
// src/client/components/TableNode.tsx
import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { SchemaTable, Group } from '../../types'

interface TableNodeProps {
  data: {
    table: SchemaTable
    group: Group | null
    selected: boolean
    dim: boolean
  }
}

export const TableNode = memo(function TableNode({ data }: TableNodeProps) {
  const { table, group, selected, dim } = data
  const groupColor = group?.color ?? 'var(--text-3)'

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: selected
          ? `1.5px solid var(--sel)`
          : '1.5px solid var(--border)',
        borderRadius: 'var(--r)',
        boxShadow: selected
          ? `0 0 0 4px var(--sel-ring), var(--shadow-md)`
          : 'var(--shadow-md)',
        minWidth: 200,
        overflow: 'hidden',
        opacity: dim ? 0.35 : 1,
        transition: 'opacity 0.18s, box-shadow 0.18s, border-color 0.18s',
        cursor: 'pointer',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />

      {/* Header */}
      <div style={{
        padding: '9px 13px 8px',
        display: 'flex', alignItems: 'center', gap: 7,
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          width: 3, height: 17, borderRadius: 2,
          background: groupColor, flexShrink: 0,
        }} />
        <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: -0.2, flex: 1, color: 'var(--text-1)' }}>
          {table.name}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600 }}>
          {table.schema}
        </span>
      </div>

      {/* Columns */}
      <div style={{ padding: '5px 0 3px' }}>
        {table.columns.map(col => (
          <div key={col.name} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '3.5px 13px', fontSize: 11.5,
          }}>
            {col.isPK ? (
              <span style={{ fontSize: 8.5, fontWeight: 800, padding: '1.5px 4px', borderRadius: 3, background: 'rgba(245,158,11,0.18)', color: '#FBBF24', minWidth: 20, textAlign: 'center' }}>PK</span>
            ) : col.isFK ? (
              <span style={{ fontSize: 8.5, fontWeight: 800, padding: '1.5px 4px', borderRadius: 3, background: 'rgba(139,92,246,0.18)', color: '#A78BFA', minWidth: 20, textAlign: 'center' }}>FK</span>
            ) : (
              <span style={{ minWidth: 20, visibility: 'hidden' }}>··</span>
            )}
            <span style={{
              fontWeight: 500, flex: 1,
              color: col.isNullable ? 'var(--text-2)' : 'var(--text-1)'
            }}>
              {col.name}
            </span>
            {col.isNullable && (
              <span style={{ fontSize: 10, color: 'var(--text-3)' }}>?</span>
            )}
            <span style={{ fontSize: 10.5, color: 'var(--text-3)', fontFamily: 'ui-monospace, monospace' }}>
              {col.dataType}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
})
```

- [ ] **Step 2: Commit**

```bash
git add src/client/components/TableNode.tsx
git commit -m "feat: add TableNode component"
```

---

## Task 10: Canvas Component

**Files:**
- Create: `src/client/components/Canvas.tsx`

- [ ] **Step 1: Implement Canvas**

```tsx
// src/client/components/Canvas.tsx
import { useCallback, useMemo } from 'react'
import {
  ReactFlow, Background, BackgroundVariant,
  useNodesState, useEdgesState, NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { TableNode } from './TableNode'
import { buildLayout } from '../lib/layout'
import { useStore } from '../store'
import type { SchemaData, Group } from '../../types'

const nodeTypes = { tableNode: TableNode }

interface CanvasProps {
  schemaData: SchemaData
  groups: Group[]
}

export function Canvas({ schemaData, groups }: CanvasProps) {
  const { selectedTables, hiddenGroups, autoExpand, toggleTable, selectTables } = useStore()

  const tableToGroup = useMemo(() => {
    const map = new Map<string, Group>()
    for (const group of groups) {
      for (const tableName of group.tables) map.set(tableName, group)
    }
    return map
  }, [groups])

  const visibleTables = useMemo(() =>
    schemaData.tables.filter(t => {
      const group = tableToGroup.get(t.name)
      return !group || !hiddenGroups.has(group.id)
    }),
    [schemaData.tables, tableToGroup, hiddenGroups]
  )

  const fkNeighbors = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const fk of schemaData.foreignKeys) {
      const addNeighbor = (a: string, b: string) => {
        if (!map.has(a)) map.set(a, new Set())
        map.get(a)!.add(b)
      }
      addNeighbor(fk.parentTable, fk.referencedTable)
      addNeighbor(fk.referencedTable, fk.parentTable)
    }
    return map
  }, [schemaData.foreignKeys])

  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(
    () => buildLayout(visibleTables, schemaData.foreignKeys),
    [visibleTables, schemaData.foreignKeys]
  )

  const hasSelection = selectedTables.size > 0

  const nodes = useMemo(() => layoutNodes.map(node => {
    const table = (node.data as { table: { name: string } }).table
    const nodeId = node.id
    const selected = selectedTables.has(nodeId)
    const dim = hasSelection && !selected
    const group = tableToGroup.get(table.name) ?? null
    return { ...node, data: { ...node.data, group, selected, dim } }
  }), [layoutNodes, selectedTables, hasSelection, tableToGroup])

  const edges = useMemo(() => layoutEdges.map(edge => {
    const sourceSelected = selectedTables.has(edge.source)
    const targetSelected = selectedTables.has(edge.target)
    const active = !hasSelection || (sourceSelected && targetSelected)
    return {
      ...edge,
      style: {
        ...edge.style,
        stroke: active ? 'rgba(74,123,245,0.5)' : 'rgba(255,255,255,0.06)',
        strokeWidth: active ? 1.5 : 1,
      }
    }
  }), [layoutEdges, selectedTables, hasSelection])

  const [rfNodes, , onNodesChange] = useNodesState(nodes)
  const [rfEdges, , onEdgesChange] = useEdgesState(edges)

  const onNodeClick: NodeMouseHandler = useCallback((_evt, node) => {
    toggleTable(node.id)
    if (autoExpand) {
      const tableName = node.id.split('.')[1]
      const neighbors = fkNeighbors.get(tableName)
      if (neighbors) {
        const allTables = new Set(schemaData.tables.map(t => `${t.schema}.${t.name}`))
        const neighborIds = [...neighbors]
          .map(n => {
            const found = schemaData.tables.find(t => t.name === n)
            return found ? `${found.schema}.${found.name}` : null
          })
          .filter((id): id is string => !!id && allTables.has(id))
        selectTables([node.id, ...neighborIds])
      }
    }
  }, [toggleTable, autoExpand, fkNeighbors, schemaData.tables, selectTables])

  return (
    <div style={{ flex: 1, background: 'var(--canvas)' }}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          color="rgba(255,255,255,0.07)"
          gap={22}
          size={1}
        />
      </ReactFlow>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/client/components/Canvas.tsx
git commit -m "feat: add Canvas component with React Flow and selection logic"
```

---

## Task 11: Sidebar Component

**Files:**
- Create: `src/client/components/Sidebar.tsx`

- [ ] **Step 1: Implement Sidebar**

```tsx
// src/client/components/Sidebar.tsx
import { useState } from 'react'
import { useStore } from '../store'
import type { SchemaData, Group } from '../../types'

interface SidebarProps {
  schemaData: SchemaData
  groups: Group[]
  onSelectGroup: (groupId: string) => void
  onAddGroup: () => void
}

export function Sidebar({ schemaData, groups, onSelectGroup, onAddGroup }: SidebarProps) {
  const [search, setSearch] = useState('')
  const { selectedTables, hiddenGroups, toggleGroupVisibility } = useStore()

  const tableToGroup = new Map<string, Group>()
  for (const group of groups) {
    for (const tableName of group.tables) tableToGroup.set(tableName, group)
  }

  const filtered = schemaData.tables.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <aside style={{
      width: 234, background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
    }}>
      {/* Groups */}
      <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.9px', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>
          Groups
        </div>
        {groups.map(group => {
          const isHidden = hiddenGroups.has(group.id)
          return (
            <div
              key={group.id}
              onClick={() => onSelectGroup(group.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 8px', borderRadius: 'var(--r-sm)',
                cursor: 'pointer', marginBottom: 2,
                background: 'transparent',
                opacity: isHidden ? 0.45 : 1,
              }}
            >
              <div style={{ width: 9, height: 9, borderRadius: 3, background: group.color, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 500, flex: 1, color: 'var(--text-1)' }}>{group.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>{group.tables.length}</span>
              <button
                onClick={e => { e.stopPropagation(); toggleGroupVisibility(group.id) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text-3)', padding: '2px 4px' }}
              >
                {isHidden ? '○' : '◉'}
              </button>
            </div>
          )
        })}
        <button
          onClick={onAddGroup}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '5px 8px', borderRadius: 'var(--r-sm)',
            cursor: 'pointer', color: 'var(--text-3)', fontSize: 12, fontWeight: 500,
            background: 'none', border: 'none', width: '100%', marginTop: 4,
          }}
        >
          + New group
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--border)' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search tables…"
          style={{
            width: '100%', padding: '7px 10px',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--r-sm)', fontFamily: 'inherit',
            fontSize: 12.5, color: 'var(--text-1)',
            background: 'var(--bg)', outline: 'none',
          }}
        />
      </div>

      {/* Table list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
        {filtered.map(table => {
          const nodeId = `${table.schema}.${table.name}`
          const isSelected = selectedTables.has(nodeId)
          const group = tableToGroup.get(table.name)
          return (
            <div
              key={nodeId}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '6px 9px', borderRadius: 'var(--r-sm)',
                cursor: 'pointer', marginBottom: 1,
                background: isSelected ? 'var(--sel-light)' : 'transparent',
              }}
            >
              <div style={{
                width: 3, height: 15, borderRadius: 2, flexShrink: 0,
                background: group?.color ?? 'var(--text-3)',
                opacity: group ? 1 : 0.3,
              }} />
              <span style={{
                fontSize: 12.5, fontWeight: 500, flex: 1,
                color: isSelected ? 'var(--sel)' : 'var(--text-1)',
              }}>
                {table.name}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>
                {table.columns.length}
              </span>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/client/components/Sidebar.tsx
git commit -m "feat: add Sidebar component"
```

---

## Task 12: Context Panel Component

**Files:**
- Create: `src/client/components/ContextPanel.tsx`

- [ ] **Step 1: Implement ContextPanel**

```tsx
// src/client/components/ContextPanel.tsx
import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { generateCondensed, generateDDL } from '../lib/context-generator'
import { estimateTokens } from '../lib/token-estimate'
import type { SchemaData } from '../../types'

interface ContextPanelProps {
  schemaData: SchemaData
}

export function ContextPanel({ schemaData }: ContextPanelProps) {
  const { selectedTables, format, autoExpand, setFormat, setAutoExpand } = useStore()
  const [copied, setCopied] = useState(false)

  const selectedTableData = useMemo(() => {
    return schemaData.tables.filter(t => selectedTables.has(`${t.schema}.${t.name}`))
  }, [schemaData.tables, selectedTables])

  const relevantFKs = useMemo(() => {
    const names = new Set(selectedTableData.map(t => t.name))
    return schemaData.foreignKeys.filter(
      fk => names.has(fk.parentTable) || names.has(fk.referencedTable)
    )
  }, [schemaData.foreignKeys, selectedTableData])

  const contextText = useMemo(() => {
    if (selectedTableData.length === 0) return ''
    return format === 'condensed'
      ? generateCondensed(selectedTableData, relevantFKs)
      : generateDDL(selectedTableData, relevantFKs)
  }, [selectedTableData, relevantFKs, format])

  const tokenCount = useMemo(() => estimateTokens(contextText), [contextText])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(contextText)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <aside style={{
      width: 308, background: 'var(--surface)',
      borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '16px 18px 13px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: -0.2, marginBottom: 3, color: 'var(--text-1)' }}>
          Context Export
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
          {selectedTables.size > 0
            ? `${selectedTables.size} table${selectedTables.size > 1 ? 's' : ''} selected · ready to copy`
            : 'Select tables on the diagram'}
        </div>
      </div>

      {/* Format switcher */}
      <div style={{ display: 'flex', padding: '12px 18px 10px', borderBottom: '1px solid var(--border)' }}>
        {(['condensed', 'ddl'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFormat(f)}
            style={{
              flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 600,
              textAlign: 'center', cursor: 'pointer',
              border: '1px solid var(--border-strong)',
              background: format === f ? 'var(--accent)' : 'var(--bg)',
              color: format === f ? 'white' : 'var(--text-2)',
              fontFamily: 'inherit',
              borderRadius: f === 'condensed' ? '8px 0 0 8px' : '0 8px 8px 0',
              borderLeft: f === 'ddl' ? 'none' : undefined,
            }}
          >
            {f === 'condensed' ? 'Condensed' : 'DDL'}
          </button>
        ))}
      </div>

      {/* Auto-expand toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '9px 18px', borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>
          Auto-expand FK neighbors
        </span>
        <div
          onClick={() => setAutoExpand(!autoExpand)}
          style={{
            width: 30, height: 17, borderRadius: 9,
            background: autoExpand ? 'var(--accent)' : '#4A4238',
            position: 'relative', cursor: 'pointer', transition: 'background 0.18s',
          }}
        >
          <div style={{
            position: 'absolute', width: 13, height: 13, borderRadius: '50%',
            background: 'white', top: 2, left: 2,
            transition: 'transform 0.18s',
            transform: autoExpand ? 'translateX(13px)' : 'none',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }} />
        </div>
      </div>

      {/* Preview */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
        {contextText ? (
          <pre style={{
            fontFamily: 'ui-monospace, Cascadia Code, monospace',
            fontSize: 11, lineHeight: 1.75, color: 'var(--text-1)',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {contextText}
          </pre>
        ) : (
          <div style={{ color: 'var(--text-3)', fontSize: 13, lineHeight: 1.6 }}>
            Select tables in the diagram to preview context output here.
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '11px 18px', borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{
            fontSize: 11, fontWeight: 800, padding: '3px 9px',
            borderRadius: 20, background: 'var(--accent-light)', color: 'var(--accent)',
          }}>
            ~{tokenCount}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>tokens</span>
        </div>
        <button
          onClick={handleCopy}
          disabled={!contextText}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 'var(--r-sm)',
            fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
            cursor: contextText ? 'pointer' : 'not-allowed',
            border: 'none',
            background: contextText ? 'var(--accent-grad)' : 'var(--text-3)',
            color: 'white',
            boxShadow: contextText ? '0 2px 10px rgba(74,123,245,0.28)' : 'none',
            opacity: contextText ? 1 : 0.5,
          }}
        >
          {copied ? '✓ Copied!' : 'Copy context'}
        </button>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/client/components/ContextPanel.tsx
git commit -m "feat: add ContextPanel component"
```

---

## Task 13: Header + Connection Modal

**Files:**
- Create: `src/client/components/Header.tsx`
- Create: `src/client/components/ConnectionModal.tsx`

- [ ] **Step 1: Implement ConnectionModal**

```tsx
// src/client/components/ConnectionModal.tsx
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Connection } from '../../types'

interface ConnectionModalProps {
  connections: Connection[]
  onClose: () => void
}

export function ConnectionModal({ connections, onClose }: ConnectionModalProps) {
  const [name, setName] = useState('')
  const [connStr, setConnStr] = useState('')
  const [testResult, setTestResult] = useState<'idle' | 'ok' | 'error'>('idle')
  const qc = useQueryClient()

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await api.api.connections.post({ name, connectionString: connStr })
      if (res.error) throw res.error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['connections'] })
      setName(''); setConnStr('')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (connName: string) => {
      const res = await api.api.connections({ name: connName }).delete()
      if (res.error) throw res.error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['connections'] })
  })

  const handleTest = async () => {
    const res = await api.api.connections.test.post({ connectionString: connStr })
    setTestResult(res.error ? 'error' : 'ok')
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--r)',
        border: '1px solid var(--border)', padding: 24, width: 420,
        boxShadow: 'var(--shadow-lg)',
      }} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: 'var(--text-1)' }}>
          Manage Connections
        </h2>

        {connections.map(c => (
          <div key={c.name} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 0', borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E' }} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{c.name}</span>
            <button
              onClick={() => deleteMutation.mutate(c.name)}
              style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 13 }}
            >
              Remove
            </button>
          </div>
        ))}

        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Connection name"
            style={{ padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border-strong)', borderRadius: 'var(--r-sm)', color: 'var(--text-1)', fontFamily: 'inherit', fontSize: 13, outline: 'none' }}
          />
          <input
            value={connStr}
            onChange={e => { setConnStr(e.target.value); setTestResult('idle') }}
            placeholder="Server=...;Database=...;User Id=...;Password=..."
            style={{ padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border-strong)', borderRadius: 'var(--r-sm)', color: 'var(--text-1)', fontFamily: 'inherit', fontSize: 13, outline: 'none' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleTest} style={{ padding: '8px 14px', background: 'var(--bg)', border: '1px solid var(--border-strong)', borderRadius: 'var(--r-sm)', color: testResult === 'ok' ? '#22C55E' : testResult === 'error' ? '#EF4444' : 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>
              {testResult === 'ok' ? '✓ Connected' : testResult === 'error' ? '✗ Failed' : 'Test'}
            </button>
            <button
              onClick={() => addMutation.mutate()}
              disabled={!name || !connStr}
              style={{ flex: 1, padding: '8px 14px', background: 'var(--accent-grad)', border: 'none', borderRadius: 'var(--r-sm)', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}
            >
              Add Connection
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Implement Header**

```tsx
// src/client/components/Header.tsx
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
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          schemaboard
        </span>

        <div style={{ width: 1, height: 18, background: 'var(--border-strong)' }} />

        <select
          value={activeConnection ?? ''}
          onChange={e => setActiveConnection(e.target.value)}
          style={{
            padding: '5px 11px', border: '1px solid var(--border-strong)',
            borderRadius: 'var(--r-sm)', cursor: 'pointer',
            fontSize: 13, fontWeight: 500, color: 'var(--text-1)',
            background: 'var(--bg)', fontFamily: 'inherit', outline: 'none',
          }}
        >
          <option value="" disabled>Select connection…</option>
          {connections.map(c => (
            <option key={c.name} value={c.name}>{c.name}</option>
          ))}
        </select>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={onRefresh}
            style={{ padding: '7px 13px', background: 'transparent', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, borderRadius: 'var(--r-sm)' }}
          >
            Refresh
          </button>
          <button
            onClick={() => setShowModal(true)}
            style={{ padding: '7px 13px', background: 'transparent', border: '1px solid var(--border-strong)', borderRadius: 'var(--r-sm)', color: 'var(--text-1)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}
          >
            Manage Connections
          </button>
        </div>
      </header>

      {showModal && (
        <ConnectionModal connections={connections} onClose={() => setShowModal(false)} />
      )}
    </>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/client/components/Header.tsx src/client/components/ConnectionModal.tsx
git commit -m "feat: add Header and ConnectionModal components"
```

---

## Task 14: Group Modal + Right-Click Assignment

**Files:**
- Create: `src/client/components/GroupModal.tsx`

- [ ] **Step 1: Implement GroupModal**

```tsx
// src/client/components/GroupModal.tsx
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Group } from '../../types'

const PRESET_COLORS = ['#3B82F6','#10B981','#F59E0B','#8B5CF6','#EF4444','#EC4899','#14B8A6','#F97316']

interface GroupModalProps {
  groups: Group[]
  onClose: () => void
}

export function GroupModal({ groups, onClose }: GroupModalProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const qc = useQueryClient()

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await api.api.groups.post({ name, color, tables: [] })
      if (res.error) throw res.error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['groups'] }); setName('') }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.groups({ id }).delete()
      if (res.error) throw res.error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] })
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={onClose}>
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--r)', border: '1px solid var(--border)', padding: 24, width: 380, boxShadow: 'var(--shadow-lg)' }} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: 'var(--text-1)' }}>Manage Groups</h2>

        {groups.map(g => (
          <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: 9, height: 9, borderRadius: 3, background: g.color }} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{g.name}</span>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{g.tables.length} tables</span>
            <button onClick={() => deleteMutation.mutate(g.id)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 13 }}>Remove</button>
          </div>
        ))}

        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Group name" style={{ padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border-strong)', borderRadius: 'var(--r-sm)', color: 'var(--text-1)', fontFamily: 'inherit', fontSize: 13, outline: 'none' }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PRESET_COLORS.map(c => (
              <div key={c} onClick={() => setColor(c)} style={{ width: 22, height: 22, borderRadius: 5, background: c, cursor: 'pointer', outline: color === c ? '2px solid white' : 'none', outlineOffset: 2 }} />
            ))}
          </div>
          <button onClick={() => addMutation.mutate()} disabled={!name} style={{ padding: '8px 14px', background: 'var(--accent-grad)', border: 'none', borderRadius: 'var(--r-sm)', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}>
            Add Group
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/client/components/GroupModal.tsx
git commit -m "feat: add GroupModal component"
```

---

## Task 15: App Root + Right-Click Context Menu

**Files:**
- Create: `src/client/App.tsx`

- [ ] **Step 1: Implement App.tsx**

```tsx
// src/client/App.tsx
import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './api/client'
import { useStore } from './store'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { Canvas } from './components/Canvas'
import { ContextPanel } from './components/ContextPanel'
import { GroupModal } from './components/GroupModal'
import type { Group, SchemaData } from '../types'

const EMPTY_SCHEMA: SchemaData = { tables: [], foreignKeys: [] }

export function App() {
  const { activeConnection, selectTables } = useStore()
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; tableId: string } | null>(null)
  const qc = useQueryClient()

  const { data: connections = [] } = useQuery({
    queryKey: ['connections'],
    queryFn: async () => {
      const res = await api.api.connections.get()
      if (res.error) throw res.error
      return res.data
    }
  })

  const { data: groups = [] } = useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const res = await api.api.groups.get()
      if (res.error) throw res.error
      return res.data
    }
  })

  const { data: schemaData = EMPTY_SCHEMA, refetch } = useQuery({
    queryKey: ['schema', activeConnection],
    enabled: !!activeConnection,
    queryFn: async () => {
      const res = await api.api.schema.get({ query: { connection: activeConnection! } })
      if (res.error) throw res.error
      return res.data
    }
  })

  const assignGroupMutation = useMutation({
    mutationFn: async ({ groupId, tableName }: { groupId: string; tableName: string }) => {
      const group = groups.find((g: Group) => g.id === groupId)!
      const tables = group.tables.includes(tableName)
        ? group.tables
        : [...group.tables, tableName]
      const res = await api.api.groups({ id: groupId }).put({ tables })
      if (res.error) throw res.error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] })
  })

  const handleSelectGroup = useCallback((groupId: string) => {
    const group = groups.find((g: Group) => g.id === groupId)
    if (!group) return
    const ids = group.tables
      .map((name: string) => schemaData.tables.find(t => t.name === name))
      .filter(Boolean)
      .map((t: any) => `${t.schema}.${t.name}`)
    selectTables(ids)
  }, [groups, schemaData.tables, selectTables])

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      onClick={() => setCtxMenu(null)}>
      <Header connections={connections} onRefresh={() => refetch()} />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar
          schemaData={schemaData}
          groups={groups}
          onSelectGroup={handleSelectGroup}
          onAddGroup={() => setShowGroupModal(true)}
        />

        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
          onContextMenu={e => {
            // handled at node level via data-table-id attribute
            const target = (e.target as HTMLElement).closest('[data-table-id]') as HTMLElement | null
            if (target) {
              e.preventDefault()
              setCtxMenu({ x: e.clientX, y: e.clientY, tableId: target.dataset.tableId! })
            }
          }}>
          {activeConnection ? (
            <Canvas schemaData={schemaData} groups={groups} />
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 14 }}>
              Select a connection to load the schema
            </div>
          )}

          {/* Right-click context menu */}
          {ctxMenu && (
            <div style={{
              position: 'fixed', left: ctxMenu.x, top: ctxMenu.y,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)', boxShadow: 'var(--shadow-lg)',
              zIndex: 50, minWidth: 160, overflow: 'hidden',
            }}>
              <div style={{ padding: '6px 0' }}>
                <div style={{ padding: '4px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  Assign to group
                </div>
                {groups.map((g: Group) => (
                  <div
                    key={g.id}
                    onClick={() => {
                      assignGroupMutation.mutate({ groupId: g.id, tableName: ctxMenu.tableId.split('.')[1] })
                      setCtxMenu(null)
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--text-1)' }}
                  >
                    <div style={{ width: 9, height: 9, borderRadius: 3, background: g.color }} />
                    {g.name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <ContextPanel schemaData={schemaData} />
      </div>

      {showGroupModal && (
        <GroupModal groups={groups} onClose={() => setShowGroupModal(false)} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add `data-table-id` to TableNode for right-click**

In `src/client/components/TableNode.tsx`, add `data-table-id={node.id}` to the outer div (React Flow provides the node id):

```tsx
// TableNode outer div — add data attribute for right-click context
<div
  data-table-id={`${data.table.schema}.${data.table.name}`}
  style={{ /* existing styles */ }}
>
```

- [ ] **Step 3: Commit**

```bash
git add src/client/App.tsx src/client/components/TableNode.tsx
git commit -m "feat: wire up App with all components, right-click group assignment"
```

---

## Task 16: Smoke Test + Polish

- [ ] **Step 1: Run all tests**

```bash
bun test
```

Expected: all pass

- [ ] **Step 2: Start dev server**

```bash
bun run dev
```

Expected: server on `:3777`, Vite on `:5173`

- [ ] **Step 3: Verify end-to-end flow**

1. Open `http://localhost:5173`
2. Click "Add Connection" → enter a real SQL Server connection string → click Test → should show green ✓
3. Click "Add Connection" to save it
4. Select the connection from the dropdown → schema ERD should load
5. Click a table node → it should highlight, neighbors auto-expand if toggle is on
6. Right-click a node → assign to a group → group color bar should update
7. Select multiple tables → context panel should show condensed output with token count
8. Toggle format to DDL → preview should switch
9. Click "Copy context" → paste into a text editor to verify

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "feat: schemaboard complete - SQL Server ERD with context export"
```

---

## Self-Review

**Spec coverage:**
- ✅ Connection string management (volatile JSON config)
- ✅ POST /connect (test connection)
- ✅ GET /schema
- ✅ CRUD /connections
- ✅ CRUD /groups
- ✅ React Flow ERD with custom TableNode
- ✅ Multi-select tables
- ✅ Auto-expand FK neighbors toggle
- ✅ Right-click node → assign to group
- ✅ Click group → select all tables in group
- ✅ Toggle group visibility
- ✅ Condensed + DDL format switcher
- ✅ Token count estimate
- ✅ Copy to clipboard
- ✅ Eden Treaty (never bare fetch)
- ✅ Warm dark espresso design system in index.css

**Potential gaps:**
- Sidebar table items don't fire `toggleTable` on click — Sidebar currently is display-only for selection state. Fix: add `onClick` to each table list item in Sidebar that calls `toggleTable(nodeId)` from the store. This is a one-line addition to the `t-item` div in Task 11.

**Type consistency check:** `SchemaData`, `SchemaTable`, `Column`, `ForeignKey`, `Group`, `Connection` are defined in Task 2 and used consistently across all tasks. `buildLayout` returns `Node[]` and `Edge[]` from `@xyflow/react` as used in Canvas. `api` client imported from `../api/client` in all components. ✅
