import { createApp } from './app'
import { SourceBrowserSession } from './source/browser-session'
import { MangasOriginesSource } from './source/mangas-origines'
import { MergedSourceService } from './source/merged-source'
import { NovelFrSource } from './source/novel-fr'

const port = Number(process.env.PORT ?? 4174)
const browser = new SourceBrowserSession()
const source = new MergedSourceService([
  new NovelFrSource(),
  new MangasOriginesSource(browser),
])
const app = createApp(source)
const server = app.listen(port, () => {
  console.log(`LN Reader server listening on http://localhost:${port}`)
})

async function shutdown() {
  server.close()
  await browser.close()
  process.exit(0)
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
