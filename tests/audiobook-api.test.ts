import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AudiobookService, audiobookNarrationSegments } from '../server/audio/audiobook-service'
import type { SpeechProvider } from '../server/audio/openai-speech'
import { createApp } from '../server/app'
import type { SourceChapterContent } from '../shared/contracts'
import type { SourceService } from '../server/source/types'

const chapter: SourceChapterContent = {
  key: 'novelFr:/chapitre-test/',
  title: 'Chapitre test',
  html: '<p>Une première phrase. Une deuxième phrase.</p>',
  blocks: [
    { kind: 'paragraph', text: 'Une première phrase. Une deuxième phrase.' },
    { kind: 'blockquote', text: 'Une citation importante.' },
  ],
  source: 'novelFr',
}

function sourceMock(content = chapter): SourceService {
  return {
    search: vi.fn().mockResolvedValue([]),
    discover: vi.fn().mockResolvedValue({ popular: [], recentlyAdded: [], recentlyUpdated: [] }),
    series: vi.fn().mockRejectedValue(new Error('Not used.')),
    chapter: vi.fn().mockResolvedValue(content),
    asset: vi.fn().mockRejectedValue(new Error('Not used.')),
  }
}

function speechProvider(): SpeechProvider & { synthesize: ReturnType<typeof vi.fn> } {
  return {
    provider: 'openai',
    model: 'gpt-4o-mini-tts',
    voice: 'coral',
    format: 'mp3',
    instructions: 'Narrate faithfully.',
    synthesize: vi.fn(async (input: string) => Buffer.from(`audio:${input}`)),
  }
}

async function waitUntilReady(service: AudiobookService, id: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const manifest = await service.manifest(id)
    if (manifest?.status === 'ready') return manifest
    if (manifest?.status === 'failed') throw new Error(manifest.error)
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  throw new Error('Timed out waiting for audiobook generation.')
}

describe('audiobook API', () => {
  let rootPath: string

  beforeEach(async () => {
    rootPath = await mkdtemp(join(tmpdir(), 'lyra-audiobook-'))
  })

  afterEach(async () => {
    await rm(rootPath, { recursive: true, force: true })
  })

  it('splits readable chapter text into bounded narration segments', () => {
    const content = {
      ...chapter,
      blocks: [{ kind: 'paragraph' as const, text: `${'Phrase complète. '.repeat(80)}Fin.` }],
    }
    const segments = audiobookNarrationSegments(content, 500)

    expect(segments.length).toBeGreaterThan(1)
    expect(segments.every((segment) => segment.text.length <= 500)).toBe(true)
    expect(segments[0]?.text).toContain('Chapitre test')
    expect(segments.at(-1)?.progressEnd).toBe(1)
  })

  it('generates, serves and reuses a cached OpenAI narration', async () => {
    const provider = speechProvider()
    const service = new AudiobookService({ rootPath, provider })
    const app = createApp(sourceMock(), undefined, service)

    const start = await request(app).post('/api/audio/chapters').send({ key: chapter.key })
    expect(start.status).toBe(202)
    expect(start.body.status).toBe('queued')

    const ready = await waitUntilReady(service, start.body.id as string)
    expect(ready.generatedSegments).toBe(ready.totalSegments)
    expect(provider.synthesize).toHaveBeenCalledTimes(ready.totalSegments)

    const status = await request(app).get(`/api/audio/chapters/${ready.id}`)
    expect(status.status).toBe(200)
    expect(status.body.status).toBe('ready')
    expect(status.body.disclosure).toContain('OpenAI')

    const audio = await request(app).get(ready.segments[0]!.url)
    expect(audio.status).toBe(200)
    expect(audio.headers['content-type']).toContain('audio/mpeg')
    expect(Buffer.from(audio.body as Uint8Array).toString('utf8')).toContain('audio:Chapitre test')

    const cached = await request(app).post('/api/audio/chapters').send({ key: chapter.key })
    expect(cached.status).toBe(200)
    expect(cached.body.id).toBe(ready.id)
    expect(provider.synthesize).toHaveBeenCalledTimes(ready.totalSegments)
  })

  it('uses a new cache identity when the chapter text changes', async () => {
    const provider = speechProvider()
    const service = new AudiobookService({ rootPath, provider })
    const first = await service.request(chapter)
    await waitUntilReady(service, first.id)

    const changed = await service.request({
      ...chapter,
      blocks: [{ kind: 'paragraph', text: 'Le chapitre a changé.' }],
    })
    await waitUntilReady(service, changed.id)

    expect(changed.id).not.toBe(first.id)
    expect(provider.synthesize).toHaveBeenCalledTimes(2)
  })

  it('advertises and protects the optional paid capability', async () => {
    const provider = speechProvider()
    const service = new AudiobookService({ rootPath, provider })
    const enabled = await request(createApp(sourceMock(), undefined, service)).get('/api/capabilities')
    const disabled = await request(createApp(sourceMock())).post('/api/audio/chapters').send({ key: chapter.key })

    expect(enabled.body.features).toContain('audiobook')
    expect(disabled.status).toBe(503)
    expect(disabled.body.error).toContain('OpenAI')
  })
})
