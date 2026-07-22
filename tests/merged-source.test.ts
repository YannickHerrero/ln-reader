import { describe, expect, it, vi } from 'vitest'
import type { SourceID, SourceSeries } from '../shared/contracts'
import { MergedSourceService } from '../server/source/merged-source'
import type { NovelSource } from '../server/source/types'

function chapter(source: SourceID, key: string, number: number) {
  return {
    key,
    title: `Chapitre ${number}`,
    number,
    volume: null,
    publishedAt: null,
    releases: [{ source, key }],
  }
}

const novelSeries: SourceSeries = {
  key: 'novelFr:/series/tbate/',
  title: 'The Beginning After the End',
  sources: [{ source: 'novelFr', key: 'novelFr:/series/tbate/' }],
  coverImage: 'https://novel-fr.net/wp-content/uploads/cover.webp',
  author: 'TurtleMe',
  description: 'Novel synopsis',
  genres: ['Fantasy'],
  status: 'Completed',
  chapters: [
    chapter('novelFr', 'novelFr:/tbate-chapitre-2/', 2),
    chapter('novelFr', 'novelFr:/tbate-chapitre-1/', 1),
  ],
}

const mangaSeries: SourceSeries = {
  key: '/oeuvre/tbate-novel/',
  title: 'The Beginning After the End – Novel',
  sources: [{ source: 'mangasOrigines', key: '/oeuvre/tbate-novel/' }],
  coverImage: null,
  author: null,
  description: null,
  genres: ['Novel'],
  status: null,
  chapters: [
    chapter('mangasOrigines', '/oeuvre/tbate-novel/chapitre-3/', 3),
    chapter('mangasOrigines', '/oeuvre/tbate-novel/chapitre-2/', 2),
  ],
}

function mockSource(id: SourceID, series: SourceSeries): NovelSource {
  return {
    id,
    search: vi.fn().mockResolvedValue([{
      key: series.key,
      title: series.title,
      sourceType: 'text',
      sources: series.sources,
    }]),
    discover: vi.fn().mockResolvedValue({ popular: [], recentlyAdded: [], recentlyUpdated: [] }),
    series: vi.fn().mockResolvedValue(series),
    chapter: vi.fn().mockResolvedValue({ key: 'release', title: 'Chapter', html: '<p>Text</p>', source: id }),
    ownsAsset: vi.fn().mockReturnValue(false),
    asset: vi.fn(),
  }
}

describe('merged novel source', () => {
  it('uses Novel-FR as primary and deduplicates chapters', async () => {
    const service = new MergedSourceService([
      mockSource('novelFr', novelSeries),
      mockSource('mangasOrigines', mangaSeries),
    ])

    const search = await service.search('tbate')
    const series = await service.series(search[0]!.key)

    expect(search).toHaveLength(1)
    expect(search[0]).toMatchObject({ key: novelSeries.key, sources: [{ source: 'novelFr' }, { source: 'mangasOrigines' }] })
    expect(series.title).toBe(novelSeries.title)
    expect(series.chapters.map((entry) => entry.number)).toEqual([3, 2, 1])
    expect(series.chapters[1]).toMatchObject({
      key: 'novelFr:/tbate-chapitre-2/',
      releases: [{ source: 'novelFr' }, { source: 'mangasOrigines' }],
    })
  })

  it('falls back to the secondary release when the primary fails', async () => {
    const novel = mockSource('novelFr', novelSeries)
    const manga = mockSource('mangasOrigines', mangaSeries)
    vi.mocked(novel.chapter).mockRejectedValue(new Error('primary unavailable'))
    vi.mocked(manga.chapter).mockResolvedValue({
      key: '/oeuvre/tbate-novel/chapitre-2/',
      title: 'Chapitre 2',
      html: '<p>Fallback</p>',
      source: 'mangasOrigines',
    })
    const service = new MergedSourceService([novel, manga])

    const content = await service.chapter('novelFr:/tbate-chapitre-2/', [
      { source: 'novelFr', key: 'novelFr:/tbate-chapitre-2/' },
      { source: 'mangasOrigines', key: '/oeuvre/tbate-novel/chapitre-2/' },
    ])

    expect(content).toMatchObject({ key: 'novelFr:/tbate-chapitre-2/', source: 'mangasOrigines', html: '<p>Fallback</p>' })
  })
})
