import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { loadEnvFile } from 'node:process'
import { createApp } from './app'
import { AudiobookService } from './audio/audiobook-service'
import { OpenAISpeechProvider } from './audio/openai-speech'
import { NovelFrSource } from './source/novel-fr'
import { SqliteSyncStore } from './sync-store'

const environmentPath = process.env.LYRA_ENV_PATH
  ? resolve(process.env.LYRA_ENV_PATH)
  : resolve(homedir(), '.config/ln-reader/server.env')
if (existsSync(environmentPath)) loadEnvFile(environmentPath)

const host = process.env.HOST ?? '127.0.0.1'
const port = Number(process.env.PORT ?? 4174)
const syncPath = process.env.LYRA_DATA_PATH ?? '.data/lyra.sqlite'
const source = new NovelFrSource()
const resolvedSyncPath = syncPath === ':memory:' ? syncPath : resolve(process.cwd(), syncPath)
const syncStore = new SqliteSyncStore(resolvedSyncPath)
const apiKey = process.env.OPENAI_API_KEY?.trim()
const audiobookLibrary = apiKey ? new AudiobookService({
  rootPath: process.env.LYRA_AUDIO_PATH
    ? resolve(process.cwd(), process.env.LYRA_AUDIO_PATH)
    : resolve(resolvedSyncPath === ':memory:' ? process.cwd() : dirname(resolvedSyncPath), 'audio'),
  provider: new OpenAISpeechProvider({
    apiKey,
    model: process.env.OPENAI_TTS_MODEL,
    voice: process.env.OPENAI_TTS_VOICE,
    instructions: process.env.OPENAI_TTS_INSTRUCTIONS,
  }),
}) : undefined
const app = createApp(source, syncStore, audiobookLibrary)
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
