import express from 'express'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const app = express()
const port = Number(process.env.PORT ?? 4174)

app.disable('x-powered-by')
app.use(express.json({ limit: '100kb' }))

app.get('/api/health', (_request, response) => {
  response.json({ ok: true })
})

const distPath = resolve(process.cwd(), 'dist')
if (existsSync(distPath)) {
  app.use(express.static(distPath))
  app.get('*splat', (_request, response) => {
    response.sendFile(resolve(distPath, 'index.html'))
  })
}

app.listen(port, () => {
  console.log(`LN Reader server listening on http://localhost:${port}`)
})
