import { Hono } from 'hono'
import type { Env } from './env'

const app = new Hono<Env>()

.get('/api/hello', (c) => {
  return c.json({ message: 'Hello Hono!' })
})

export type AppType = typeof app

export { app }