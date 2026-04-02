import type { SchemaData } from '../../types'
export type { DbType } from '../../types'

export interface DbAdapter {
  testConnection(connectionString: string): Promise<void>
  listSchemas(connectionString: string): Promise<string[]>
  fetchSchema(connectionString: string, excludedSchemas?: string[]): Promise<SchemaData>
}
