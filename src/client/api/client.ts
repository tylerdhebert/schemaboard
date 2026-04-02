import { treaty } from '@elysiajs/eden'
import type { App } from '../../server/index'

export const api = treaty<App>('localhost:3777')
