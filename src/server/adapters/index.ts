import type { DbAdapter } from './types'
import type { DbType } from '../../types'
import { sqlServerAdapter } from './sqlserver'
import { postgresAdapter } from './postgres'
import { sqliteAdapter } from './sqlite'

export function getAdapter(type: DbType): DbAdapter {
  switch (type) {
    case 'sqlserver': return sqlServerAdapter
    case 'postgres':  return postgresAdapter
    case 'sqlite':    return sqliteAdapter
  }
}
