import { Elysia, t } from 'elysia'
import { createGroup, deleteGroup, listGroups, reorderGroups, updateGroup, updateGroupMembership } from '../config'
import { randomUUID } from 'crypto'

export const groupsRouter = new Elysia({ prefix: '/api/groups' })
  .get('/', () => listGroups())

  .post('/reorder', ({ body, set }) => {
    const ok = reorderGroups(body.groupIds)
    if (!ok) {
      set.status = 400
      return { error: 'Invalid group order' }
    }
    return { ok: true }
  }, {
    body: t.Object({
      groupIds: t.Array(t.String())
    })
  })

  .post('/membership', ({ body, set }) => {
    const ok = updateGroupMembership(body.tableName, body.action, body.groupId)
    if (!ok) {
      set.status = 404
      return { error: 'Group not found' }
    }
    return { ok: true }
  }, {
    body: t.Object({
      tableName: t.String(),
      action: t.Union([t.Literal('add'), t.Literal('remove'), t.Literal('clear')]),
      groupId: t.Optional(t.String())
    })
  })

  .post('/', ({ body }) => {
    return createGroup({ ...body, id: randomUUID() })
  }, {
    body: t.Object({
      name: t.String(),
      color: t.String(),
      tables: t.Array(t.String())
    })
  })

  .put('/:id', ({ params, body, set }) => {
    const group = updateGroup(params.id, body)
    if (!group) {
      set.status = 404
      return { error: 'Group not found' }
    }
    return group
  }, {
    body: t.Object({
      name: t.Optional(t.String()),
      color: t.Optional(t.String()),
      tables: t.Optional(t.Array(t.String()))
    })
  })

  .delete('/:id', ({ params }) => {
    deleteGroup(params.id)
    return { ok: true }
  })
