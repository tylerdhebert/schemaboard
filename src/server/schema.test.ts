import { describe, test, expect } from 'bun:test'
import { buildSchemaData } from './adapters/shared'

describe('buildSchemaData', () => {
  test('merges raw rows into structured SchemaData', () => {
    const rawColumns = [
      { schema: 'dbo', tableName: 'Orders', columnName: 'Id', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: 'NO', defaultValue: null },
      { schema: 'dbo', tableName: 'Orders', columnName: 'CustomerId', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: 'NO', defaultValue: null },
    ]
    const rawPKs = [{ schema: 'dbo', tableName: 'Orders', columnName: 'Id' }]
    const rawFKs = [{
      parentSchema: 'dbo', parentTable: 'Orders', parentColumn: 'CustomerId',
      referencedSchema: 'dbo', referencedTable: 'Customers', referencedColumn: 'Id'
    }]

    const result = buildSchemaData(rawColumns, rawPKs, rawFKs)

    expect(result.tables).toHaveLength(1)
    expect(result.tables[0].name).toBe('Orders')
    expect(result.tables[0].columns[0].isPK).toBe(true)
    expect(result.tables[0].columns[1].isFK).toBe(true)
    expect(result.tables[0].columns[1].referencesTable).toBe('Customers')
    expect(result.foreignKeys).toHaveLength(1)
  })
})
