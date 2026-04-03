import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { connectionsRouter } from './routes/connections'
import { groupsRouter } from './routes/groups'
import { schemaRouter } from './routes/schema'
import { snapshotsRouter } from './routes/snapshots'
import { workspacesRouter } from './routes/workspaces'

const app = new Elysia()
  .use(cors())
  .use(connectionsRouter)
  .use(groupsRouter)
  .use(schemaRouter)
  .use(workspacesRouter)
  .use(snapshotsRouter)
  .listen(process.env.SERVER_PORT ?? 3777)

const { hostname, port } = app.server!
console.log(`schemaboard server running on http://${hostname}:${port}`)

export type App = typeof app
