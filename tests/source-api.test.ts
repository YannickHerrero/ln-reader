import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { createApp } from '../server/app'
import type { SourceService } from '../server/source/types'

function sourceMock(): SourceService {
  return {
    search: vi.fn().mockResolvedValue([{ key: '/oeuvre/toradora/', title: 'Toradora!', sourceType: 'text' }]),
    series: vi.fn().mockResolvedValue({
      key: '/oeuvre/toradora/',
      title: 'Toradora!',
      coverImage: null,
      author: null,
      description: null,
      genres: ['Novel'],
      status: null,
      chapters: [],
    }),
    chapter: vi.fn().mockResolvedValue({ key: '/oeuvre/toradora/chapitre-1/', title: 'Chapitre 1', html: '<p>Texte</p>' }),
    asset: vi.fn().mockResolvedValue({ body: Buffer.from('image'), contentType: 'image/webp' }),
  }
}

describe('source API', () => {
  it('returns search results', async () => {
    const source = sourceMock()
    const response = await request(createApp(source)).get('/api/source/search').query({ q: 'toradora' })

    expect(response.status).toBe(200)
    expect(response.body[0].title).toBe('Toradora!')
    expect(source.search).toHaveBeenCalledWith('toradora')
  })

  it('validates short searches', async () => {
    const response = await request(createApp(sourceMock())).get('/api/source/search').query({ q: 'a' })

    expect(response.status).toBe(400)
    expect(response.body.error).toContain('2 to 100')
  })
})
