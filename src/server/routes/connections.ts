import { Elysia, t } from 'elysia'
import { readConfig, writeConfig } from '../config'
import { testConnection } from '../schema'

export const connectionsRouter = new Elysia({ prefix: '/api/connections' })
  .get('/', () => readConfig().connections)

  .post('/', ({ body }) => {
    const config = readConfig()
    config.connections.push(body)
    writeConfig(config)
    return body
  }, {
    body: t.Object({
      name: t.String(),
      connectionString: t.String()
    })
  })

  .post('/test', async ({ body }) => {
    await testConnection(body.connectionString)
    return { ok: true }
  }, {
    body: t.Object({ connectionString: t.String() })
  })

  .delete('/:name', ({ params }) => {
    const config = readConfig()
    config.connections = config.connections.filter(c => c.name !== params.name)
    writeConfig(config)
    return { ok: true }
  })
