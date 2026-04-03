// src/types.ts

export type DbType = 'sqlserver' | 'postgres' | 'sqlite'
export type LayoutType = 'dagre' | 'force' | 'elk'

export interface Column {
  name: string
  dataType: string
  maxLength: number | null
  numericPrecision: number | null
  numericScale: number | null
  isNullable: boolean
  isPK: boolean
  isFK: boolean
  referencesTable: string | null
  referencesColumn: string | null
}

export interface SchemaTable {
  schema: string
  name: string
  columns: Column[]
}

export interface ForeignKey {
  parentTable: string
  parentColumn: string
  referencedTable: string
  referencedColumn: string
}

export interface SchemaData {
  tables: SchemaTable[]
  foreignKeys: ForeignKey[]
}

export interface Connection {
  name: string
  connectionString: string
  type: DbType
  excludedSchemas?: string[]
  includedTables?: string[]   // qualified "schema.table"; empty/absent = all tables
}

export interface Group {
  id: string
  name: string
  color: string
  tables: string[]   // table names (unqualified)
}

export interface AppConfig {
  connections: Connection[]
  groups: Group[]
}
