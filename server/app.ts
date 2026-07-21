import express, { type NextFunction, type Request, type Response } from 'express'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ApiErrorBody } from '../shared/contracts'
import type { SourceService } from './source/types'

function queryString(request: Request, name: string): string {
  const value = request.query[name]
  if (typeof value !== 'string') throw new Error(`Missing ${name}.`)
  return value
}

export function createApp(source: SourceService) {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '100kb' }))

  app.get('/api/health', (_request, response) => {
    response.json({ ok: true })
  })

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
