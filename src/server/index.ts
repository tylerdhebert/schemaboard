import { Elysia } from 'elysia'
import { connectionsRouter } from './routes/connections'
import { groupsRouter } from './routes/groups'
import { schemaRouter } from './routes/schema'

const app = new Elysia()
  .use(connectionsRouter)
  .use(groupsRouter)
  .use(schemaRouter)
  .listen(process.env.SERVER_PORT ?? 3777)

const { hostname, port } = app.server!
console.log(`schemaboard server running on http://${hostname}:${port}`)

export type App = typeof app
