import { createApp } from './app'
import { NovelFrSource } from './source/novel-fr'

const host = process.env.HOST ?? '127.0.0.1'
const port = Number(process.env.PORT ?? 4174)
const source = new NovelFrSource()
const app = createApp(source)
const server = app.listen(port, host, () => {
  console.log(`LN Reader server listening on http://${host}:${port}`)
})

function shutdown() {
  server.close()
  process.exit(0)
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
