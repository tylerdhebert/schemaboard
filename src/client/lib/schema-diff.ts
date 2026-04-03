import type { Column, ForeignKey, SchemaData, SchemaTable } from '../../types'

export interface SchemaDiffColumnRef {
  tableId: string
  columnName: string
}

export interface SchemaDiffColumnChange extends SchemaDiffColumnRef {
  changes: string[]
}

export interface SchemaDiffResult {
  currentOnlyTables: string[]
  comparisonOnlyTables: string[]
  currentOnlyColumns: SchemaDiffColumnRef[]
  comparisonOnlyColumns: SchemaDiffColumnRef[]
  changedColumns: SchemaDiffColumnChange[]
  currentOnlyForeignKeys: string[]
  comparisonOnlyForeignKeys: string[]
}

function tableId(table: SchemaTable): string {
  return `${table.schema}.${table.name}`
}

function foreignKeyId(foreignKey: ForeignKey): string {
  return `${foreignKey.parentTable}.${foreignKey.parentColumn} -> ${foreignKey.referencedTable}.${foreignKey.referencedColumn}`
}

function describeValue(value: number | string | null): string {
  return value == null ? 'none' : String(value)
}

function compareColumns(current: Column, comparison: Column): string[] {
  const changes: string[] = []

  if (current.dataType !== comparison.dataType) {
    changes.push(`type ${comparison.dataType} -> ${current.dataType}`)
  }

  if (current.isNullable !== comparison.isNullable) {
    changes.push(`nullability ${comparison.isNullable ? 'NULL' : 'NOT NULL'} -> ${current.isNullable ? 'NULL' : 'NOT NULL'}`)
  }

  if (current.isPK !== comparison.isPK) {
    changes.push(`primary key ${comparison.isPK ? 'yes' : 'no'} -> ${current.isPK ? 'yes' : 'no'}`)
  }

  if (current.maxLength !== comparison.maxLength) {
    changes.push(`max length ${describeValue(comparison.maxLength)} -> ${describeValue(current.maxLength)}`)
  }

  if (current.numericPrecision !== comparison.numericPrecision || current.numericScale !== comparison.numericScale) {
    const previous = `${describeValue(comparison.numericPrecision)},${describeValue(comparison.numericScale)}`
    const next = `${describeValue(current.numericPrecision)},${describeValue(current.numericScale)}`
    changes.push(`precision/scale ${previous} -> ${next}`)
  }

  const comparisonReference = comparison.referencesTable && comparison.referencesColumn
    ? `${comparison.referencesTable}.${comparison.referencesColumn}`
    : null
  const currentReference = current.referencesTable && current.referencesColumn
    ? `${current.referencesTable}.${current.referencesColumn}`
    : null

  if (current.isFK !== comparison.isFK || currentReference !== comparisonReference) {
    changes.push(`foreign key ${comparisonReference ?? 'none'} -> ${currentReference ?? 'none'}`)
  }

  return changes
}

export function diffSchemas(current: SchemaData, comparison: SchemaData): SchemaDiffResult {
  const currentTables = new Map(current.tables.map(table => [tableId(table), table]))
  const comparisonTables = new Map(comparison.tables.map(table => [tableId(table), table]))

  const currentOnlyTables = [...currentTables.keys()].filter(id => !comparisonTables.has(id)).sort()
  const comparisonOnlyTables = [...comparisonTables.keys()].filter(id => !currentTables.has(id)).sort()

  const currentOnlyColumns: SchemaDiffColumnRef[] = []
  const comparisonOnlyColumns: SchemaDiffColumnRef[] = []
  const changedColumns: SchemaDiffColumnChange[] = []

  for (const [id, currentTable] of currentTables) {
    const comparisonTable = comparisonTables.get(id)
    if (!comparisonTable) continue

    const currentColumns = new Map(currentTable.columns.map(column => [column.name, column]))
    const comparisonColumns = new Map(comparisonTable.columns.map(column => [column.name, column]))

    for (const [columnName, column] of currentColumns) {
      const comparisonColumn = comparisonColumns.get(columnName)
      if (!comparisonColumn) {
        currentOnlyColumns.push({ tableId: id, columnName })
        continue
      }

      const changes = compareColumns(column, comparisonColumn)
      if (changes.length > 0) {
        changedColumns.push({ tableId: id, columnName, changes })
      }
    }

    for (const columnName of comparisonColumns.keys()) {
      if (!currentColumns.has(columnName)) {
        comparisonOnlyColumns.push({ tableId: id, columnName })
      }
    }
  }

  const currentForeignKeys = new Set(current.foreignKeys.map(foreignKeyId))
  const comparisonForeignKeys = new Set(comparison.foreignKeys.map(foreignKeyId))

  return {
    currentOnlyTables,
    comparisonOnlyTables,
    currentOnlyColumns: currentOnlyColumns.sort((a, b) => `${a.tableId}.${a.columnName}`.localeCompare(`${b.tableId}.${b.columnName}`)),
    comparisonOnlyColumns: comparisonOnlyColumns.sort((a, b) => `${a.tableId}.${a.columnName}`.localeCompare(`${b.tableId}.${b.columnName}`)),
    changedColumns: changedColumns.sort((a, b) => `${a.tableId}.${a.columnName}`.localeCompare(`${b.tableId}.${b.columnName}`)),
    currentOnlyForeignKeys: [...currentForeignKeys].filter(id => !comparisonForeignKeys.has(id)).sort(),
    comparisonOnlyForeignKeys: [...comparisonForeignKeys].filter(id => !currentForeignKeys.has(id)).sort(),
  }
}
