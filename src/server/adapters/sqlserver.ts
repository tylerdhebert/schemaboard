import sql from 'mssql'
import { buildSchemaData } from './shared'
import type { DbAdapter } from './types'

// Normalize a connection string key (lowercase, strip spaces/underscores)
function normKey(k: string) {
  return k.toLowerCase().replace(/[\s_]/g, '')
}

// Parse an ADO.NET-style connection string into a key→value map
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

// Returns true if connection string requests Windows/integrated authentication
function isWindowsAuth(parts: Record<string, string>): boolean {
  const intSec = parts['integratedsecurity'] ?? parts['trustedconnection'] ?? ''
  const val = intSec.toLowerCase()
  return val === 'true' || val === 'yes' || val === 'sspi'
}

// Build an mssql config for Windows auth from a parsed connection string.
// Uses authentication.type='default' which tells tedious to use SSPI on Windows.
function buildWindowsAuthConfig(parts: Record<string, string>): sql.config {
  const server =
    parts['datasource'] ?? parts['server'] ?? parts['address'] ?? parts['addr'] ?? parts['networkaddress'] ?? ''
  const database = parts['initialcatalog'] ?? parts['database'] ?? ''
  const trustCert =
    (parts['trustservercertificate'] ?? '').toLowerCase() === 'true' ||
    (parts['trustservercertificate'] ?? '').toLowerCase() === 'yes'

  return {
    server,
    database,
    authentication: { type: 'default', options: {} },
    options: {
      trustServerCertificate: trustCert,
      enableArithAbort: true,
    },
  }
}

// Returns a connection string or config object ready for sql.connect()
function resolveConfig(connectionString: string): string | sql.config {
  const parts = parseConnStr(connectionString)
  if (isWindowsAuth(parts)) return buildWindowsAuthConfig(parts)
  return connectionString
}

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

export const sqlServerAdapter: DbAdapter = {
  async testConnection(connectionString) {
    try {
      const pool = await sql.connect(resolveConfig(connectionString))
      await pool.close()
    } catch (err) {
      throw new Error(`Connection failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  },

  async fetchSchema(connectionString) {
    let pool: sql.ConnectionPool | undefined
    try {
      pool = await sql.connect(resolveConfig(connectionString))
      const [colResult, pkResult, fkResult] = await Promise.all([
        pool.request().query(COLUMNS_QUERY),
        pool.request().query(PKS_QUERY),
        pool.request().query(FKS_QUERY),
      ])
      return buildSchemaData(colResult.recordset, pkResult.recordset, fkResult.recordset)
    } finally {
      await pool?.close()
    }
  },
}
