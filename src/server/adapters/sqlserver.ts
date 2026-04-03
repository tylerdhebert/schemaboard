import sql from 'mssql'
import { buildSchemaData, filterColumns } from './shared'
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
  c.COLUMN_DEFAULT           AS defaultValue
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
  AND tc.TABLE_SCHEMA = ccu.TABLE_SCHEMA
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

// --- Windows auth helpers ---

function normKey(k: string) {
  return k.toLowerCase().replace(/[\s_]/g, '')
}

function parseConnStr(connStr: string): Record<string, string> {
  const map: Record<string, string> = {}
  for (const segment of connStr.split(';')) {
    const eq = segment.indexOf('=')
    if (eq === -1) continue
    const k = normKey(segment.slice(0, eq).trim())
    const v = segment.slice(eq + 1).trim()
    if (k) map[k] = v
  }
  return map
}

function isWindowsAuth(parts: Record<string, string>): boolean {
  const val = (parts['integratedsecurity'] ?? parts['trustedconnection'] ?? '').toLowerCase()
  return val === 'true' || val === 'yes' || val === 'sspi'
}

function buildOdbcConnStr(parts: Record<string, string>): string {
  const server = parts['datasource'] ?? parts['server'] ?? parts['address'] ?? parts['addr'] ?? ''
  const database = parts['initialcatalog'] ?? parts['database'] ?? ''
  const trustCert = ['true', 'yes'].includes((parts['trustservercertificate'] ?? '').toLowerCase())
  return [
    'Driver={ODBC Driver 17 for SQL Server}',
    `Server=${server}`,
    database ? `Database=${database}` : '',
    'Trusted_Connection=yes',
    trustCert ? 'TrustServerCertificate=yes' : '',
  ].filter(Boolean).join(';') + ';'
}

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>
    if (obj.message) return String(obj.message)
    return JSON.stringify(obj)
  }
  return String(err)
}

async function connect(connectionString: string): Promise<sql.ConnectionPool> {
  const parts = parseConnStr(connectionString)
  if (isWindowsAuth(parts)) {
    const sqlWin = (await import('mssql/msnodesqlv8')).default as typeof sql
    return sqlWin.connect({ connectionString: buildOdbcConnStr(parts) } as unknown as sql.config)
  }
  return sql.connect(connectionString)
}

// ---

export const sqlServerAdapter: DbAdapter = {
  async testConnection(connectionString) {
    try {
      const pool = await connect(connectionString)
      await pool.close()
    } catch (err) {
      throw new Error(`Connection failed: ${errMsg(err)}`)
    }
  },

  async listSchemas(connectionString) {
    let pool: sql.ConnectionPool | undefined
    try {
      pool = await connect(connectionString)
      const result = await pool.request().query(
        `SELECT DISTINCT TABLE_SCHEMA AS [schema] FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_SCHEMA`
      )
      return result.recordset.map((r: { schema: string }) => r.schema)
    } finally {
      await pool?.close()
    }
  },

  async listTables(connectionString) {
    let pool: sql.ConnectionPool | undefined
    try {
      pool = await connect(connectionString)
      const result = await pool.request().query(
        `SELECT TABLE_SCHEMA AS [schema], TABLE_NAME AS tableName FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_SCHEMA, TABLE_NAME`
      )
      return result.recordset.map((r: { schema: string; tableName: string }) => `${r.schema}.${r.tableName}`)
    } finally {
      await pool?.close()
    }
  },

  async fetchSchema(connectionString, excludedSchemas, includedTables) {
    let pool: sql.ConnectionPool | undefined
    try {
      pool = await connect(connectionString)
      const [colResult, pkResult, fkResult] = await Promise.all([
        pool.request().query(COLUMNS_QUERY),
        pool.request().query(PKS_QUERY),
        pool.request().query(FKS_QUERY),
      ])
      const cols = filterColumns(colResult.recordset, excludedSchemas, includedTables)
      return buildSchemaData(cols, pkResult.recordset, fkResult.recordset)
    } finally {
      await pool?.close()
    }
  },
}
