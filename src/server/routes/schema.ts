import { Elysia, t } from 'elysia'
import { readConfig } from '../config'
import { fetchSchema } from '../schema'

export const schemaRouter = new Elysia({ prefix: '/api/schema' })
  .get('/', async ({ query, set }) => {
    const config = readConfig()
    const conn = config.connections.find(c => c.name === query.connection)
    if (!conn) {
      set.status = 404
      return { error: `Connection "${query.connection}" not found` }
    }
    try {
      return await fetchSchema(conn.connectionString)
    } catch (err) {
      set.status = 502
      return { error: err instanceof Error ? err.message : String(err) }
    }
  }, {
    query: t.Object({ connection: t.String() })
  })
