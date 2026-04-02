import { Elysia, t } from 'elysia'
import { readConfig, writeConfig } from '../config'
import { randomUUID } from 'crypto'

export const groupsRouter = new Elysia({ prefix: '/api/groups' })
  .get('/', () => readConfig().groups)

  .post('/', ({ body }) => {
    const config = readConfig()
    const group = { ...body, id: randomUUID() }
    config.groups.push(group)
    writeConfig(config)
    return group
  }, {
    body: t.Object({
      name: t.String(),
      color: t.String(),
      tables: t.Array(t.String())
    })
  })

  .put('/:id', ({ params, body }) => {
    const config = readConfig()
    const idx = config.groups.findIndex(g => g.id === params.id)
    if (idx === -1) throw new Error('Group not found')
    config.groups[idx] = { ...config.groups[idx], ...body }
    writeConfig(config)
    return config.groups[idx]
  }, {
    body: t.Object({
      name: t.Optional(t.String()),
      color: t.Optional(t.String()),
      tables: t.Optional(t.Array(t.String()))
    })
  })

  .delete('/:id', ({ params }) => {
    const config = readConfig()
    config.groups = config.groups.filter(g => g.id !== params.id)
    writeConfig(config)
    return { ok: true }
  })
