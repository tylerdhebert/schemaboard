import type { SchemaData, SchemaTable, Column, ForeignKey } from '../../types'

export type RawColumn = {
  schema: string
  tableName: string
  columnName: string
  dataType: string
  maxLength: number | null
  numericPrecision: number | null
  numericScale: number | null
  isNullable: 'YES' | 'NO'
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

export function filterColumns<T extends { schema: string; tableName: string }>(
  rows: T[],
  excludedSchemas: string[] | undefined,
  includedTables: string[] | undefined,
): T[] {
  const excluded = excludedSchemas?.length ? new Set(excludedSchemas) : null
  const included = includedTables?.length ? new Set(includedTables) : null
  if (!excluded && !included) return rows
  return rows.filter(r => {
    if (excluded?.has(r.schema)) return false
    if (included && !included.has(`${r.schema}.${r.tableName}`)) return false
    return true
  })
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

  // ForeignKey intentionally omits schema fields — the frontend resolves FK relationships
  // by unqualified table name via tableByName Map lookups. Acceptable because table names
  // are unique across schemas in practice; multi-schema same-name tables are not supported.
  const foreignKeys: ForeignKey[] = rawFKs.map(fk => ({
    parentTable: fk.parentTable,
    parentColumn: fk.parentColumn,
    referencedTable: fk.referencedTable,
    referencedColumn: fk.referencedColumn,
  }))

  return { tables: Array.from(tableMap.values()), foreignKeys }
}
