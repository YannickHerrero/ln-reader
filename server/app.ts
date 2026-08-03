import express, { type NextFunction, type Request, type Response } from 'express'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ApiCapabilities, ApiErrorBody } from '../shared/contracts'
import { parseSyncRequest } from '../shared/sync'
import type { AudiobookLibrary } from './audio/audiobook-service'
import type { SourceService } from './source/types'
import type { SyncStateStore } from './sync-store'

function queryString(request: Request, name: string): string {
  const value = request.query[name]
  if (typeof value !== 'string') throw new Error(`Missing ${name}.`)
  return value
}

export function createApp(
  source: SourceService,
  syncStore?: SyncStateStore,
  audiobookLibrary?: AudiobookLibrary,
) {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '2mb' }))

  app.get('/api/health', (_request, response) => {
    response.json({ ok: true })
  })

  app.get('/api/capabilities', (_request, response: Response<ApiCapabilities>) => {
    response.set('Cache-Control', 'private, max-age=300')
    const features: ApiCapabilities['features'] = ['chapterBlocks', 'sync']
    if (audiobookLibrary) features.push('audiobook')
    response.json({ apiVersion: 1, features })
  })

  if (syncStore) {
    app.get('/api/sync', (_request, response) => {
      response.set('Cache-Control', 'no-store')
      response.json(syncStore.getState())
    })

    app.post('/api/sync', (request, response) => {
      response.set('Cache-Control', 'no-store')
      response.json(syncStore.applyOperations(parseSyncRequest(request.body).operations))
    })
  }

  app.get('/api/source/search', async (request, response) => {
    const query = queryString(request, 'q').trim()
    if (query.length < 2 || query.length > 100) throw new Error('Search must contain 2 to 100 characters.')
    response.set('Cache-Control', 'private, max-age=60')
    response.json(await source.search(query))
  })

  app.get('/api/source/discover', async (_request, response) => {
    response.set('Cache-Control', 'private, max-age=300')
    response.json(await source.discover())
  })

  app.get('/api/source/series', async (request, response) => {
    response.set('Cache-Control', 'private, max-age=300')
    response.json(await source.series(queryString(request, 'key')))
  })

  app.get('/api/source/chapter', async (request, response) => {
    response.set('Cache-Control', 'no-store')
    response.json(await source.chapter(queryString(request, 'key')))
  })

  app.get('/api/source/asset', async (request, response) => {
    const asset = await source.asset(queryString(request, 'url'))
    response.set('Cache-Control', 'public, max-age=86400')
    response.type(asset.contentType).send(asset.body)
  })

  app.post('/api/audio/chapters', async (request, response) => {
    response.set('Cache-Control', 'no-store')
    if (!audiobookLibrary) {
      response.status(503).json({ error: "La narration OpenAI n’est pas configurée sur ce serveur." })
      return
    }
    const key = request.body?.key
    if (typeof key !== 'string' || key.length === 0 || key.length > 500) {
      throw new Error('Invalid chapter key.')
    }
    const manifest = await audiobookLibrary.request(await source.chapter(key))
    response.status(manifest.status === 'ready' ? 200 : 202).json(manifest)
  })

  app.get('/api/audio/chapters/:id', async (request, response) => {
    response.set('Cache-Control', 'no-store')
    if (!audiobookLibrary) {
      response.status(503).json({ error: "La narration OpenAI n’est pas configurée sur ce serveur." })
      return
    }
    const manifest = await audiobookLibrary.manifest(request.params.id)
    if (!manifest) {
      response.status(404).json({ error: 'Cette narration est introuvable.' })
      return
    }
    response.json(manifest)
  })

  app.get('/api/audio/chapters/:id/segments/:index', async (request, response) => {
    if (!audiobookLibrary) {
      response.status(503).json({ error: "La narration OpenAI n’est pas configurée sur ce serveur." })
      return
    }
    const index = Number(request.params.index)
    const path = await audiobookLibrary.segmentPath(request.params.id, index)
    if (!path) {
      response.status(404).json({ error: 'Ce segment audio est introuvable.' })
      return
    }
    response.set('Cache-Control', 'private, max-age=31536000, immutable')
    response.type('audio/mpeg').sendFile(path)
  })

  const distPath = resolve(process.cwd(), 'dist')
  if (existsSync(distPath)) {
    app.use(express.static(distPath))
    app.get('*splat', (_request, response) => {
      response.sendFile(resolve(distPath, 'index.html'))
    })
  }

  app.use((error: unknown, _request: Request, response: Response<ApiErrorBody>, _next: NextFunction) => {
    void _next
    const message = error instanceof Error ? error.message : 'Unexpected server error.'
    const isInputError = /^(Missing|Invalid|Search must)/.test(message)
    if (!isInputError) console.error(error)
    response.status(isInputError ? 400 : 502).json({ error: message })
  })

  return app
}
