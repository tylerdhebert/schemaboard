import type { SchemaTable, ForeignKey, Column } from '../../types'

function formatType(col: Column): string {
  if (['nvarchar', 'varchar', 'char', 'nchar'].includes(col.dataType)) {
    if (col.maxLength == null) return col.dataType
    const len = col.maxLength === -1 ? 'max' : col.maxLength
    return `${col.dataType}(${len})`
  }
  if (['decimal', 'numeric'].includes(col.dataType)) {
    if (col.numericPrecision == null || col.numericScale == null) return col.dataType
    return `${col.dataType}(${col.numericPrecision},${col.numericScale})`
  }
  return col.dataType
}

export function generateCondensed(tables: SchemaTable[], foreignKeys: ForeignKey[]): string {
  const tableLines = tables.map(table => {
    const cols = table.columns.map(col => {
      if (col.isPK) return `${col.name} PK`
      if (col.isFK) return `${col.name} FK→${col.referencesTable}`
      const nullable = col.isNullable ? '?' : ''
      return `${col.name}${nullable} ${formatType(col)}`
    })
    return `${table.name} (${cols.join(', ')})`
  })

  const lines = tableLines.join('\n\n')
  if (foreignKeys.length === 0) return lines

  const relLines = foreignKeys.map(
    fk => `- ${fk.parentTable}.${fk.parentColumn} → ${fk.referencedTable}.${fk.referencedColumn}`
  )
  return `${lines}\n\nRelationships:\n${relLines.join('\n')}`
}

export function generateDDL(tables: SchemaTable[], foreignKeys: ForeignKey[]): string {
  // Build schema-qualified FK lookup: "parentSchema.parentTable.parentColumn" → fk + refSchema
  const tableByName = new Map(tables.map(t => [t.name, t]))

  const fkMap = new Map(
    foreignKeys.map(fk => {
      const parentTable = tableByName.get(fk.parentTable)
      const refTable = tableByName.get(fk.referencedTable)
      const key = parentTable
        ? `${parentTable.schema}.${fk.parentTable}.${fk.parentColumn}`
        : `${fk.parentTable}.${fk.parentColumn}`
      return [key, { fk, refSchema: refTable?.schema ?? 'dbo' }]
    })
  )

  return tables.map(table => {
    const colDefs = table.columns.map(col => {
      const type = formatType(col)
      const nullable = col.isNullable ? 'NULL' : 'NOT NULL'
      const pk = col.isPK ? ' PRIMARY KEY' : ''
      const entry = fkMap.get(`${table.schema}.${table.name}.${col.name}`)
      const ref = entry
        ? ` REFERENCES ${entry.refSchema}.${entry.fk.referencedTable}(${entry.fk.referencedColumn})`
        : ''
      return `  ${col.name} ${type} ${nullable}${pk}${ref}`
    })
    return `CREATE TABLE ${table.schema}.${table.name} (\n${colDefs.join(',\n')}\n)`
  }).join('\n\n')
}
