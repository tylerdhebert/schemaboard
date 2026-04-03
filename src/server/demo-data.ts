import type { Column, ForeignKey, SchemaData, SchemaTable } from '../types'

export const DEMO_SCHEMA: SchemaData = {
  tables: [
    {
      schema: 'dbo',
      name: 'Customers',
      columns: [
        { name: 'Id', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: true, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'Email', dataType: 'nvarchar', maxLength: 255, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'FirstName', dataType: 'nvarchar', maxLength: 100, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'LastName', dataType: 'nvarchar', maxLength: 100, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'CreatedAt', dataType: 'datetime2', maxLength: null, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
      ],
    },
    {
      schema: 'dbo',
      name: 'Addresses',
      columns: [
        { name: 'Id', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: true, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'CustomerId', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: false, isFK: true, referencesTable: 'Customers', referencesColumn: 'Id' },
        { name: 'Street', dataType: 'nvarchar', maxLength: 200, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'City', dataType: 'nvarchar', maxLength: 100, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'State', dataType: 'nvarchar', maxLength: 50, numericPrecision: null, numericScale: null, isNullable: true, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'PostalCode', dataType: 'nvarchar', maxLength: 20, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'Country', dataType: 'nvarchar', maxLength: 2, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'IsDefault', dataType: 'bit', maxLength: null, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
      ],
    },
    {
      schema: 'store',
      name: 'Categories',
      columns: [
        { name: 'Id', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: true, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'ParentId', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: true, isPK: false, isFK: true, referencesTable: 'Categories', referencesColumn: 'Id' },
        { name: 'Name', dataType: 'nvarchar', maxLength: 150, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'Slug', dataType: 'varchar', maxLength: 150, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'SortOrder', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
      ],
    },
    {
      schema: 'store',
      name: 'Products',
      columns: [
        { name: 'Id', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: true, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'CategoryId', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: false, isFK: true, referencesTable: 'Categories', referencesColumn: 'Id' },
        { name: 'Sku', dataType: 'varchar', maxLength: 80, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'Name', dataType: 'nvarchar', maxLength: 255, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'Price', dataType: 'decimal', maxLength: null, numericPrecision: 10, numericScale: 2, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'StockQty', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'IsActive', dataType: 'bit', maxLength: null, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'CreatedAt', dataType: 'datetime2', maxLength: null, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
      ],
    },
    {
      schema: 'store',
      name: 'Orders',
      columns: [
        { name: 'Id', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: true, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'CustomerId', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: false, isFK: true, referencesTable: 'Customers', referencesColumn: 'Id' },
        { name: 'ShippingAddressId', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: true, isPK: false, isFK: true, referencesTable: 'Addresses', referencesColumn: 'Id' },
        { name: 'Status', dataType: 'nvarchar', maxLength: 50, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'OrderedAt', dataType: 'datetime2', maxLength: null, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'ShippedAt', dataType: 'datetime2', maxLength: null, numericPrecision: null, numericScale: null, isNullable: true, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'TotalAmount', dataType: 'decimal', maxLength: null, numericPrecision: 10, numericScale: 2, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
      ],
    },
    {
      schema: 'store',
      name: 'OrderItems',
      columns: [
        { name: 'Id', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: true, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'OrderId', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: false, isFK: true, referencesTable: 'Orders', referencesColumn: 'Id' },
        { name: 'ProductId', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: false, isFK: true, referencesTable: 'Products', referencesColumn: 'Id' },
        { name: 'Quantity', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'UnitPrice', dataType: 'decimal', maxLength: null, numericPrecision: 10, numericScale: 2, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
      ],
    },
    {
      schema: 'payments',
      name: 'PaymentMethods',
      columns: [
        { name: 'Id', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: true, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'CustomerId', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: false, isFK: true, referencesTable: 'Customers', referencesColumn: 'Id' },
        { name: 'Type', dataType: 'nvarchar', maxLength: 30, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'Last4', dataType: 'char', maxLength: 4, numericPrecision: null, numericScale: null, isNullable: true, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'ExpiryMonth', dataType: 'tinyint', maxLength: null, numericPrecision: 3, numericScale: 0, isNullable: true, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'ExpiryYear', dataType: 'smallint', maxLength: null, numericPrecision: 5, numericScale: 0, isNullable: true, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'IsDefault', dataType: 'bit', maxLength: null, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
      ],
    },
    {
      schema: 'payments',
      name: 'Transactions',
      columns: [
        { name: 'Id', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: true, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'OrderId', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: false, isFK: true, referencesTable: 'Orders', referencesColumn: 'Id' },
        { name: 'PaymentMethodId', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: true, isPK: false, isFK: true, referencesTable: 'PaymentMethods', referencesColumn: 'Id' },
        { name: 'Amount', dataType: 'decimal', maxLength: null, numericPrecision: 10, numericScale: 2, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'Status', dataType: 'nvarchar', maxLength: 30, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'ProcessedAt', dataType: 'datetime2', maxLength: null, numericPrecision: null, numericScale: null, isNullable: true, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'GatewayRef', dataType: 'varchar', maxLength: 200, numericPrecision: null, numericScale: null, isNullable: true, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
      ],
    },
    {
      schema: 'audit',
      name: 'AuditLog',
      columns: [
        { name: 'Id', dataType: 'bigint', maxLength: null, numericPrecision: 19, numericScale: 0, isNullable: false, isPK: true, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'EntityType', dataType: 'varchar', maxLength: 100, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'EntityId', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'Action', dataType: 'varchar', maxLength: 20, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'UserId', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: true, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'ChangedAt', dataType: 'datetime2', maxLength: null, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        { name: 'Payload', dataType: 'nvarchar', maxLength: -1, numericPrecision: null, numericScale: null, isNullable: true, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
      ],
    },
  ],
  foreignKeys: [
    { parentTable: 'Addresses',      parentColumn: 'CustomerId',        referencedTable: 'Customers',     referencedColumn: 'Id' },
    { parentTable: 'Categories',     parentColumn: 'ParentId',          referencedTable: 'Categories',    referencedColumn: 'Id' },
    { parentTable: 'Products',       parentColumn: 'CategoryId',        referencedTable: 'Categories',    referencedColumn: 'Id' },
    { parentTable: 'Orders',         parentColumn: 'CustomerId',        referencedTable: 'Customers',     referencedColumn: 'Id' },
    { parentTable: 'Orders',         parentColumn: 'ShippingAddressId', referencedTable: 'Addresses',     referencedColumn: 'Id' },
    { parentTable: 'OrderItems',     parentColumn: 'OrderId',           referencedTable: 'Orders',        referencedColumn: 'Id' },
    { parentTable: 'OrderItems',     parentColumn: 'ProductId',         referencedTable: 'Products',      referencedColumn: 'Id' },
    { parentTable: 'PaymentMethods', parentColumn: 'CustomerId',        referencedTable: 'Customers',     referencedColumn: 'Id' },
    { parentTable: 'Transactions',   parentColumn: 'OrderId',           referencedTable: 'Orders',        referencedColumn: 'Id' },
    { parentTable: 'Transactions',   parentColumn: 'PaymentMethodId',   referencedTable: 'PaymentMethods',referencedColumn: 'Id' },
  ],
}

function tableKey(table: SchemaTable): string {
  return `${table.schema}.${table.name}`
}

function replaceColumn(columns: Column[], columnName: string, nextColumn: Column): Column[] {
  return columns.map(column => column.name === columnName ? nextColumn : column)
}

function removeColumn(columns: Column[], columnName: string): Column[] {
  return columns.filter(column => column.name !== columnName)
}

const CUSTOMER_SEGMENTS_TABLE: SchemaTable = {
  schema: 'crm',
  name: 'CustomerSegments',
  columns: [
    { name: 'Id', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: true, isFK: false, referencesTable: null, referencesColumn: null },
    { name: 'Key', dataType: 'varchar', maxLength: 40, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
    { name: 'Name', dataType: 'nvarchar', maxLength: 120, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
    { name: 'Priority', dataType: 'tinyint', maxLength: null, numericPrecision: 3, numericScale: 0, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
  ],
}

const FULFILLMENT_EVENTS_TABLE: SchemaTable = {
  schema: 'ops',
  name: 'FulfillmentEvents',
  columns: [
    { name: 'Id', dataType: 'bigint', maxLength: null, numericPrecision: 19, numericScale: 0, isNullable: false, isPK: true, isFK: false, referencesTable: null, referencesColumn: null },
    { name: 'OrderId', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: false, isFK: true, referencesTable: 'Orders', referencesColumn: 'Id' },
    { name: 'AddressId', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: false, isFK: true, referencesTable: 'Addresses', referencesColumn: 'Id' },
    { name: 'Stage', dataType: 'nvarchar', maxLength: 30, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
    { name: 'OccurredAt', dataType: 'datetime2', maxLength: null, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
    { name: 'Actor', dataType: 'nvarchar', maxLength: 80, numericPrecision: null, numericScale: null, isNullable: true, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
  ],
}

const DEMO_SCHEMA_2_TABLES = DEMO_SCHEMA.tables
  .filter(table => tableKey(table) !== 'audit.AuditLog')
  .map(table => {
    const key = tableKey(table)

    if (key === 'dbo.Customers') {
      return {
        ...table,
        columns: [
          ...table.columns,
          { name: 'SegmentId', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: true, isPK: false, isFK: true, referencesTable: 'CustomerSegments', referencesColumn: 'Id' },
        ],
      }
    }

    if (key === 'store.Products') {
      return {
        ...table,
        columns: [
          ...removeColumn(table.columns, 'StockQty'),
          { name: 'AvailableQty', dataType: 'int', maxLength: null, numericPrecision: 10, numericScale: 0, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
          { name: 'CompareAtPrice', dataType: 'decimal', maxLength: null, numericPrecision: 12, numericScale: 2, isNullable: true, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        ].map(column => column.name === 'Price'
          ? { ...column, numericPrecision: 12 }
          : column),
      }
    }

    if (key === 'store.Orders') {
      return {
        ...table,
        columns: [
          ...replaceColumn(table.columns, 'ShippingAddressId', {
            name: 'ShippingAddressId',
            dataType: 'int',
            maxLength: null,
            numericPrecision: 10,
            numericScale: 0,
            isNullable: false,
            isPK: false,
            isFK: true,
            referencesTable: 'Addresses',
            referencesColumn: 'Id',
          }),
          { name: 'CurrencyCode', dataType: 'char', maxLength: 3, numericPrecision: null, numericScale: null, isNullable: false, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        ].map(column => column.name === 'Status'
          ? { ...column, maxLength: 32 }
          : column),
      }
    }

    if (key === 'payments.PaymentMethods') {
      return {
        ...table,
        columns: removeColumn(table.columns, 'IsDefault'),
      }
    }

    if (key === 'payments.Transactions') {
      return {
        ...table,
        columns: [
          ...replaceColumn(table.columns, 'GatewayRef', {
            name: 'GatewayRef',
            dataType: 'varchar',
            maxLength: 120,
            numericPrecision: null,
            numericScale: null,
            isNullable: true,
            isPK: false,
            isFK: false,
            referencesTable: null,
            referencesColumn: null,
          }),
          { name: 'FailureCode', dataType: 'varchar', maxLength: 30, numericPrecision: null, numericScale: null, isNullable: true, isPK: false, isFK: false, referencesTable: null, referencesColumn: null },
        ],
      }
    }

    return table
  })

const DEMO_SCHEMA_2_FOREIGN_KEYS: ForeignKey[] = [
  ...DEMO_SCHEMA.foreignKeys,
  { parentTable: 'Customers', parentColumn: 'SegmentId', referencedTable: 'CustomerSegments', referencedColumn: 'Id' },
  { parentTable: 'FulfillmentEvents', parentColumn: 'OrderId', referencedTable: 'Orders', referencedColumn: 'Id' },
  { parentTable: 'FulfillmentEvents', parentColumn: 'AddressId', referencedTable: 'Addresses', referencedColumn: 'Id' },
]

export const DEMO_SCHEMA_2: SchemaData = {
  tables: [
    ...DEMO_SCHEMA_2_TABLES,
    CUSTOMER_SEGMENTS_TABLE,
    FULFILLMENT_EVENTS_TABLE,
  ],
  foreignKeys: DEMO_SCHEMA_2_FOREIGN_KEYS,
}
