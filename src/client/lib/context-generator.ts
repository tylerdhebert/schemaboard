import type { SchemaTable, ForeignKey, Column } from '../../types'

function formatType(col: Column): string {
  if (['nvarchar', 'varchar', 'char', 'nchar'].includes(col.dataType)) {
    const len = col.maxLength === -1 ? 'max' : col.maxLength
    return `${col.dataType}(${len})`
  }
  if (['decimal', 'numeric'].includes(col.dataType)) {
    return `${col.dataType}(${col.numericPrecision},${col.numericScale})`
  }
  return col.dataType
}

export function generateCondensed(tables: SchemaTable[], foreignKeys: ForeignKey[]): string {
  const relevantTableNames = new Set(tables.map(t => t.name))
  const relevantFKs = foreignKeys.filter(
    fk => relevantTableNames.has(fk.parentTable)
  )

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
