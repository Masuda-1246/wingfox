import { Hono } from 'hono'

const app = new Hono()

.get('/api/hello', (c) => {
  return c.json({ message: 'Hello Hono!' })
})

export type AppType = typeof app

export { app }