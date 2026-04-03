import { Elysia, t } from 'elysia'
import { getConnection } from '../config'
import { getAdapter } from '../adapters'
import { DEMO_SCHEMA, DEMO_SCHEMA_2 } from '../demo-data'

export const schemaRouter = new Elysia({ prefix: '/api/schema' })
  .get('/demo', () => DEMO_SCHEMA)
  .get('/demo2', () => DEMO_SCHEMA_2)

  .get('/', async ({ query, set }) => {
    const conn = getConnection(query.connection)
    if (!conn) {
      set.status = 404
      return { error: `Connection "${query.connection}" not found` }
    }
    try {
      return await getAdapter(conn.type).fetchSchema(conn.connectionString, conn.excludedSchemas, conn.includedTables)
    } catch (err) {
      set.status = 502
      return { error: err instanceof Error ? err.message : String(err) }
    }
  }, {
    query: t.Object({ connection: t.String() })
  })
