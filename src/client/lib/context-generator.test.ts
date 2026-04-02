import { describe, test, expect } from 'bun:test'
import { generateCondensed, generateDDL } from './context-generator'
import type { SchemaTable, ForeignKey } from '../../types'

const tables: SchemaTable[] = [{
  schema: 'dbo',
  name: 'Orders',
  columns: [
    { name: 'Id', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: true, isFK: false, referencesTable: null, referencesColumn: null },
    { name: 'CustomerId', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: false, isFK: true, referencesTable: 'Customers', referencesColumn: 'Id' },
    { name: 'Total', dataType: 'decimal', maxLength: null, numericPrecision: 10, numericScale: 2, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
    { name: 'Notes', dataType: 'nvarchar', maxLength: 500, numericPrecision: null, numericScale: null, isNullable: true, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
  ]
}]

const fks: ForeignKey[] = [{
  parentTable: 'Orders', parentColumn: 'CustomerId',
  referencedTable: 'Customers', referencedColumn: 'Id'
}]

describe('generateCondensed', () => {
  test('formats table with PK, FK, nullable, type annotations', () => {
    const result = generateCondensed(tables, fks)
    expect(result).toContain('Orders')
    expect(result).toContain('Id PK')
    expect(result).toContain('CustomerId FK→Customers')
    expect(result).toContain('Notes? nvarchar(500)')
    expect(result).toContain('decimal(10,2)')
  })

  test('includes relationship section when FKs exist', () => {
    const result = generateCondensed(tables, fks)
    expect(result).toContain('Relationships:')
    expect(result).toContain('Orders.CustomerId → Customers.Id')
  })
})

describe('generateDDL', () => {
  test('generates CREATE TABLE with correct types and constraints', () => {
    const result = generateDDL(tables, fks)
    expect(result).toContain('CREATE TABLE dbo.Orders')
    expect(result).toContain('Id int NOT NULL PRIMARY KEY')
    expect(result).toContain('CustomerId int NOT NULL REFERENCES dbo.Customers(Id)')
    expect(result).toContain('Notes nvarchar(500) NULL')
    expect(result).toContain('Total decimal(10,2) NOT NULL')
  })
})
