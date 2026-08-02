import { resolve } from 'node:path'
import { createApp } from './app'
import { NovelFrSource } from './source/novel-fr'
import { SqliteSyncStore } from './sync-store'

const host = process.env.HOST ?? '127.0.0.1'
const port = Number(process.env.PORT ?? 4174)
const syncPath = process.env.LYRA_DATA_PATH ?? '.data/lyra.sqlite'
const source = new NovelFrSource()
const syncStore = new SqliteSyncStore(syncPath === ':memory:' ? syncPath : resolve(process.cwd(), syncPath))
const app = createApp(source, syncStore)
const server = app.listen(port, host, () => {
  console.log(`LN Reader server listening on http://${host}:${port}`)
})

function shutdown() {
  server.close(() => {
    syncStore.close()
    process.exit(0)
  })
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
