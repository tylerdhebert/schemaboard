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
    config.connections.push({
      ...body,
      excludedSchemas: body.excludedSchemas ?? [],
      includedTables: body.includedTables ?? [],
    })
    writeConfig(config)
    return body
  }, {
    body: t.Object({
      name: t.String(),
      connectionString: t.String(),
      type: DbTypeSchema,
      excludedSchemas: t.Optional(t.Array(t.String())),
      includedTables: t.Optional(t.Array(t.String())),
    })
  })

  .post('/test', async ({ body }) => {
    const adapter = getAdapter(body.type)
    try {
      await adapter.testConnection(body.connectionString)
      const schemas = await adapter.listSchemas(body.connectionString).catch(() => [])
      return { ok: true, schemas }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err), schemas: [] }
    }
  }, {
    body: t.Object({
      connectionString: t.String(),
      type: DbTypeSchema,
    })
  })

  .post('/tables', async ({ body }) => {
    try {
      const tables = await getAdapter(body.type).listTables(body.connectionString)
      return { tables }
    } catch (err) {
      return { tables: [] as string[], error: err instanceof Error ? err.message : String(err) }
    }
  }, {
    body: t.Object({
      connectionString: t.String(),
      type: DbTypeSchema,
    })
  })

  .put('/:name', ({ params, body, set }) => {
    const config = readConfig()
    const idx = config.connections.findIndex(c => c.name === params.name)
    if (idx === -1) {
      set.status = 404
      return { error: `Connection "${params.name}" not found` }
    }
    if (body.name !== params.name && config.connections.some(c => c.name === body.name)) {
      set.status = 409
      return { error: `Connection "${body.name}" already exists` }
    }
    config.connections[idx] = {
      ...body,
      excludedSchemas: body.excludedSchemas ?? [],
      includedTables: body.includedTables ?? [],
    }
    writeConfig(config)
    return config.connections[idx]
  }, {
    params: t.Object({ name: t.String() }),
    body: t.Object({
      name: t.String(),
      connectionString: t.String(),
      type: DbTypeSchema,
      excludedSchemas: t.Optional(t.Array(t.String())),
      includedTables: t.Optional(t.Array(t.String())),
    })
  })

  .delete('/:name', ({ params }) => {
    const config = readConfig()
    config.connections = config.connections.filter(c => c.name !== params.name)
    writeConfig(config)
    return { ok: true }
  })
