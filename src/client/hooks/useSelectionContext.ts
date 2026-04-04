import { useMemo } from 'react'
import { useStore } from '../store'
import { generateCondensed, generateDDL } from '../lib/context-generator'
import type { SchemaData } from '../../types'

export function tableIdFromSchemaParts(schema: string, name: string): string {
  return `${schema}.${name}`
}

export function tableNameFromId(tableId: string): string {
  return tableId.split('.').slice(1).join('.')
}

export function useSelectionContext(schemaData: SchemaData) {
  const { selectedTables, format } = useStore()

  const selectedTableIds = useMemo(() => [...selectedTables], [selectedTables])
  const selectedTableNames = useMemo(() => selectedTableIds.map(tableNameFromId), [selectedTableIds])

  const selectedTableData = useMemo(
    () => schemaData.tables.filter(table => selectedTables.has(tableIdFromSchemaParts(table.schema, table.name))),
    [schemaData.tables, selectedTables]
  )

  const relevantFKs = useMemo(() => {
    const names = new Set(selectedTableData.map(table => table.name))
    return schemaData.foreignKeys.filter(fk => names.has(fk.parentTable))
  }, [schemaData.foreignKeys, selectedTableData])

  const contextText = useMemo(() => {
    if (selectedTableData.length === 0) return ''
    return format === 'condensed'
      ? generateCondensed(selectedTableData, relevantFKs)
      : generateDDL(selectedTableData, relevantFKs)
  }, [selectedTableData, relevantFKs, format])

  return {
    format,
    selectedTables,
    selectedTableIds,
    selectedTableNames,
    selectedTableData,
    relevantFKs,
    contextText,
  }
}
