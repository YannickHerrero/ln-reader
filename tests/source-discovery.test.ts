import { describe, expect, it, vi } from 'vitest'
import { MangasOriginesSource } from '../server/source/mangas-origines'
import type { SourceHttpClient } from '../server/source/types'

function card(title: string, slug: string) {
  return `<div class="page-item-detail text"><div class="post-title"><a href="https://mangas-origines.fr/oeuvre/${slug}/">${title}</a></div><img data-src="/wp-content/uploads/${slug}.webp"></div>`
}

describe('Mangas-Origines discovery', () => {
  it('requests text-only feeds and caches the combined result', async () => {
    const request = vi.fn<SourceHttpClient['request']>(async (_path, options) => {
      const body = options?.body ?? ''
      const html = body.includes('_wp_manga_views')
        ? card('Popular Novel', 'popular')
        : body.includes('_latest_update')
          ? card('Updated Novel', 'updated')
          : card('New Novel', 'new')
      return { status: 200, contentType: 'text/html', body: Buffer.from(html) }
    })
    const client: SourceHttpClient = { request, close: vi.fn() }
    const source = new MangasOriginesSource(client)

    const first = await source.discover()
    const second = await source.discover()

    expect(first).toEqual({
      popular: [expect.objectContaining({ title: 'Popular Novel' })],
      recentlyAdded: [expect.objectContaining({ title: 'New Novel' })],
      recentlyUpdated: [expect.objectContaining({ title: 'Updated Novel' })],
    })
    expect(second).toBe(first)
    expect(request).toHaveBeenCalledTimes(3)
    for (const call of request.mock.calls) {
      expect(call[1]?.body).toContain('vars%5Bmeta_query%5D%5B0%5D%5Bvalue%5D=text')
    }
  })

  it('loads cover assets without the metadata request delay', async () => {
    const request = vi.fn<SourceHttpClient['request']>().mockResolvedValue({
      status: 200,
      contentType: 'image/webp',
      body: Buffer.from('cover'),
    })
    const source = new MangasOriginesSource({ request, close: vi.fn() })

    await source.asset('https://mangas-origines.fr/wp-content/uploads/cover.webp')

    expect(request).toHaveBeenCalledWith('/wp-content/uploads/cover.webp', { pace: false })
  })
})
