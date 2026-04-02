import { Elysia, t } from 'elysia'
import { readConfig } from '../config'
import { fetchSchema } from '../schema'

export const schemaRouter = new Elysia({ prefix: '/api/schema' })
  .get('/', async ({ query }) => {
    const config = readConfig()
    const conn = config.connections.find(c => c.name === query.connection)
    if (!conn) throw new Error(`Connection "${query.connection}" not found`)
    return fetchSchema(conn.connectionString)
  }, {
    query: t.Object({ connection: t.String() })
  })
