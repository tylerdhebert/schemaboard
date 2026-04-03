import { Elysia, t } from 'elysia'
import { createConnection, deleteConnection, listConnections, updateConnection } from '../config'
import { getAdapter } from '../adapters'
import { DbTypeSchema } from '../route-schemas'

export const connectionsRouter = new Elysia({ prefix: '/api/connections' })
  .get('/', () => listConnections())

  .post('/', ({ body, set }) => {
    const result = createConnection(body)
    if (!result.ok) {
      set.status = 409
      return { error: `Connection "${body.name}" already exists` }
    }
    return result.value
  }, {
    body: t.Object({
      name: t.String(),
      connectionString: t.String(),
      type: DbTypeSchema,
      excludedSchemas: t.Optional(t.Array(t.String())),
      includedTables: t.Optional(t.Array(t.String())),
      hideAllInitially: t.Optional(t.Boolean()),
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
    const result = updateConnection(params.name, body)

    if (!result.ok && result.reason === 'not_found') {
      set.status = 404
      return { error: `Connection "${params.name}" not found` }
    }

    if (!result.ok && result.reason === 'conflict') {
      set.status = 409
      return { error: `Connection "${body.name}" already exists` }
    }

    return result.value
  }, {
    params: t.Object({ name: t.String() }),
    body: t.Object({
      name: t.String(),
      connectionString: t.String(),
      type: DbTypeSchema,
      excludedSchemas: t.Optional(t.Array(t.String())),
      includedTables: t.Optional(t.Array(t.String())),
      hideAllInitially: t.Optional(t.Boolean()),
    })
  })

  .delete('/:name', ({ params }) => {
    deleteConnection(params.name)
    return { ok: true }
  })
