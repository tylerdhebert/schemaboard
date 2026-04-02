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

type RawColumn = {
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
type RawPK = { schema: string; tableName: string; columnName: string }
type RawFK = {
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
  // Schema-qualified keys prevent collisions when same table name exists in multiple schemas
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

  // Map RawFK to ForeignKey (dropping schema fields not in the public type)
  const foreignKeys: ForeignKey[] = rawFKs.map(fk => ({
    parentTable: fk.parentTable,
    parentColumn: fk.parentColumn,
    referencedTable: fk.referencedTable,
    referencedColumn: fk.referencedColumn,
  }))

  return {
    tables: Array.from(tableMap.values()),
    foreignKeys,
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
  try {
    const pool = await sql.connect(connectionString)
    await pool.close()
  } catch (err) {
    throw new Error(`Connection failed: ${err instanceof Error ? err.message : String(err)}`)
  }
}
