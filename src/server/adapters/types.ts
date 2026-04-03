import type { SchemaData } from '../../types'
export type { DbType } from '../../types'

export interface DbAdapter {
  testConnection(connectionString: string): Promise<void>
  listSchemas(connectionString: string): Promise<string[]>
  listTables(connectionString: string): Promise<string[]>  // qualified "schema.table"
  fetchSchema(connectionString: string, excludedSchemas?: string[], includedTables?: string[]): Promise<SchemaData>
}
