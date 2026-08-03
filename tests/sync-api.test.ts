import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../server/app'
import type { SourceService } from '../server/source/types'
import { SqliteSyncStore } from '../server/sync-store'

function sourceMock(): SourceService {
  return {
    search: vi.fn().mockResolvedValue([]),
    discover: vi.fn().mockResolvedValue({ popular: [], recentlyAdded: [], recentlyUpdated: [] }),
    series: vi.fn().mockRejectedValue(new Error('Not used.')),
    chapter: vi.fn().mockRejectedValue(new Error('Not used.')),
    asset: vi.fn().mockRejectedValue(new Error('Not used.')),
  }
}

let store: SqliteSyncStore

beforeEach(() => {
  store = new SqliteSyncStore(':memory:')
})

afterEach(() => {
  store.close()
})

describe('sync API', () => {
  it('advertises the native client contract', async () => {
    const response = await request(createApp(sourceMock(), store)).get('/api/capabilities')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ apiVersion: 1, features: ['chapterBlocks', 'sync'] })
  })

  it('returns an empty no-store state before the first device syncs', async () => {
    const response = await request(createApp(sourceMock(), store)).get('/api/sync')

    expect(response.status).toBe(200)
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.body).toEqual({ revision: 0, series: [], progress: [] })
  })

  it('applies operations and returns the canonical state', async () => {
    const response = await request(createApp(sourceMock(), store)).post('/api/sync').send({
      operations: [{
        operationId: 'series-operation',
        type: 'upsert-series',
        changedAt: 100,
        record: {
          addedAt: 100,
          updatedAt: 100,
          series: {
            key: 'novelFr:/series/example/',
            title: 'Example',
            sources: [{ source: 'novelFr', key: 'novelFr:/series/example/' }],
            coverImage: null,
            author: null,
            description: null,
            genres: ['Novel'],
            status: null,
            chapters: [{
              key: 'novelFr:/chapter/1/',
              title: 'Chapitre 1',
              number: 1,
              volume: null,
              publishedAt: null,
              releases: [{ source: 'novelFr', key: 'novelFr:/chapter/1/' }],
            }],
          },
        },
      }],
    })

    expect(response.status).toBe(200)
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.body).toMatchObject({
      revision: 1,
      series: [{ series: { key: 'novelFr:/series/example/', title: 'Example' } }],
    })
  })

  it('rejects malformed operations without changing server state', async () => {
    const app = createApp(sourceMock(), store)
    const response = await request(app).post('/api/sync').send({
      operations: [{ operationId: 'bad', type: 'save-progress', record: { scrollRatio: 3 } }],
    })

    expect(response.status).toBe(400)
    expect(response.body.error).toMatch(/^Invalid sync/)
    expect((await request(app).get('/api/sync')).body).toEqual({ revision: 0, series: [], progress: [] })
  })
})
