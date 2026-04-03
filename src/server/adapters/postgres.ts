import { Client } from 'pg'
import { buildSchemaData, filterColumns } from './shared'
import type { DbAdapter } from './types'

// Excludes system schemas; aliases match RawColumn/RawPK/RawFK field names expected by buildSchemaData.
// Quoted aliases (e.g. "tableName") preserve camelCase in pg row objects.
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

  async listSchemas(connectionString) {
    const client = new Client({ connectionString })
    await client.connect()
    try {
      const result = await client.query(
        `SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast') ORDER BY schema_name`
      )
      return result.rows.map((r: { schema_name: string }) => r.schema_name)
    } finally {
      await client.end()
    }
  },

  async listTables(connectionString) {
    const client = new Client({ connectionString })
    await client.connect()
    try {
      const result = await client.query(
        `SELECT table_schema, table_name FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('pg_catalog','information_schema') ORDER BY table_schema, table_name`
      )
      return result.rows.map((r: { table_schema: string; table_name: string }) => `${r.table_schema}.${r.table_name}`)
    } finally {
      await client.end()
    }
  },

  async fetchSchema(connectionString, excludedSchemas, includedTables) {
    const client = new Client({ connectionString })
    await client.connect()
    try {
      const [colResult, pkResult, fkResult] = await Promise.all([
        client.query(COLUMNS_QUERY),
        client.query(PKS_QUERY),
        client.query(FKS_QUERY),
      ])
      const cols = filterColumns(colResult.rows, excludedSchemas, includedTables)
      return buildSchemaData(cols, pkResult.rows, fkResult.rows)
    } finally {
      await client.end()
    }
  },
}
