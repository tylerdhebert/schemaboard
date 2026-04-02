import type { SchemaData } from '../../types'
export type { DbType } from '../../types'

export interface DbAdapter {
  testConnection(connectionString: string): Promise<void>
  fetchSchema(connectionString: string): Promise<SchemaData>
}
