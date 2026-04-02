import { Elysia, t } from 'elysia'
import { readConfig, writeConfig } from '../config'
import { getAdapter } from '../adapters'

const DbTypeSchema = t.Union([
  t.Literal('sqlserver'),
  t.Literal('postgres'),
  t.Literal('sqlite'),
])

export const connectionsRouter = new Elysia({ prefix: '/api/connections' })
  .get('/', () => readConfig().connections)

  .post('/', ({ body, set }) => {
    const config = readConfig()
    if (config.connections.some(c => c.name === body.name)) {
      set.status = 409
      return { error: `Connection "${body.name}" already exists` }
    }
    config.connections.push(body)
    writeConfig(config)
    return body
  }, {
    body: t.Object({
      name: t.String(),
      connectionString: t.String(),
      type: DbTypeSchema,
    })
  })

  .post('/test', async ({ body }) => {
    try {
      await getAdapter(body.type).testConnection(body.connectionString)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }, {
    body: t.Object({
      connectionString: t.String(),
      type: DbTypeSchema,
    })
  })

  .delete('/:name', ({ params }) => {
    const config = readConfig()
    config.connections = config.connections.filter(c => c.name !== params.name)
    writeConfig(config)
    return { ok: true }
  })
