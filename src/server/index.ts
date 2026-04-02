import { Elysia } from 'elysia'
import { connectionsRouter } from './routes/connections'
import { groupsRouter } from './routes/groups'
import { schemaRouter } from './routes/schema'

const app = new Elysia()
  .use(connectionsRouter)
  .use(groupsRouter)
  .use(schemaRouter)
  .listen(3777)

console.log('schemaboard server running on http://localhost:3777')

export type App = typeof app
