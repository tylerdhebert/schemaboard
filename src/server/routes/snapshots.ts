import { randomUUID } from 'crypto'
import { Elysia, t } from 'elysia'
import {
  createSchemaSnapshot,
  deleteSchemaSnapshot,
  getSchemaSnapshot,
  listSchemaSnapshots,
} from '../config'
import { SchemaDataSchema } from '../route-schemas'

export const snapshotsRouter = new Elysia({ prefix: '/api/snapshots' })
  .get('/', ({ query }) => listSchemaSnapshots(query.connection), {
    query: t.Object({ connection: t.String() }),
  })

  .get('/:id', ({ params, set }) => {
    const snapshot = getSchemaSnapshot(params.id)
    if (!snapshot) {
      set.status = 404
      return { error: 'Snapshot not found' }
    }

    return snapshot
  }, {
    params: t.Object({ id: t.String() }),
  })

  .post('/', ({ body, set }) => {
    const result = createSchemaSnapshot({
      id: randomUUID(),
      connectionName: body.connectionName,
      name: body.name,
      schema: body.schema,
    })

    if (!result.ok) {
      set.status = 409
      return { error: `Snapshot "${body.name}" already exists` }
    }

    return result.value
  }, {
    body: t.Object({
      connectionName: t.String(),
      name: t.String(),
      schema: SchemaDataSchema,
    }),
  })

  .delete('/:id', ({ params }) => {
    deleteSchemaSnapshot(params.id)
    return { ok: true }
  }, {
    params: t.Object({ id: t.String() }),
  })
