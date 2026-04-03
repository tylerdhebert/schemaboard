import { randomUUID } from 'crypto'
import { Elysia, t } from 'elysia'
import { createWorkspace, deleteWorkspace, listWorkspaces, updateWorkspace } from '../config'
import { WorkspaceStateSchema } from '../route-schemas'

export const workspacesRouter = new Elysia({ prefix: '/api/workspaces' })
  .get('/', ({ query }) => listWorkspaces(query.connection), {
    query: t.Object({ connection: t.String() }),
  })

  .post('/', ({ body, set }) => {
    const result = createWorkspace({
      id: randomUUID(),
      connectionName: body.connectionName,
      name: body.name,
      state: body.state,
    })

    if (!result.ok) {
      set.status = 409
      return { error: `Workspace "${body.name}" already exists` }
    }

    return result.value
  }, {
    body: t.Object({
      connectionName: t.String(),
      name: t.String(),
      state: WorkspaceStateSchema,
    }),
  })

  .put('/:id', ({ params, body, set }) => {
    const result = updateWorkspace(params.id, body)

    if (!result.ok && result.reason === 'not_found') {
      set.status = 404
      return { error: 'Workspace not found' }
    }

    if (!result.ok && result.reason === 'conflict') {
      set.status = 409
      return { error: `Workspace "${body.name}" already exists` }
    }

    return result.value
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      name: t.String(),
      state: WorkspaceStateSchema,
    }),
  })

  .delete('/:id', ({ params }) => {
    deleteWorkspace(params.id)
    return { ok: true }
  }, {
    params: t.Object({ id: t.String() }),
  })
