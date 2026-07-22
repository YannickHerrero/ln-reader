import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SourceSeries } from '../shared/contracts'
import { LibraryDatabase } from '../src/db/database'
import { LibraryRepository } from '../src/db/repository'

const series: SourceSeries = {
  key: '/oeuvre/example/',
  title: 'Example Novel',
  sources: [{ source: 'novelFr', key: '/oeuvre/example/' }],
  coverImage: null,
  author: 'Jane Doe',
  description: 'Synopsis',
  genres: ['Novel'],
  status: 'En cours',
  chapters: [
    { key: '/oeuvre/example/chapitre-2/', title: 'Chapitre 2', number: 2, volume: null, publishedAt: null, releases: [{ source: 'novelFr', key: '/oeuvre/example/chapitre-2/' }] },
    { key: '/oeuvre/example/chapitre-1/', title: 'Chapitre 1', number: 1, volume: null, publishedAt: null, releases: [{ source: 'novelFr', key: '/oeuvre/example/chapitre-1/' }] },
  ],
}

let database: LibraryDatabase
let repository: LibraryRepository

beforeEach(() => {
  database = new LibraryDatabase(`test-${crypto.randomUUID()}`)
  repository = new LibraryRepository(database)
})

afterEach(async () => {
  await database.delete()
  vi.restoreAllMocks()
})

describe('local library repository', () => {
  it('stores series and keeps the original added date when refreshing', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(100)
    await repository.addOrUpdateSeries(series)
    now.mockReturnValue(200)
    await repository.addOrUpdateSeries({ ...series, title: 'Updated title' })

    expect(await repository.listSeries()).toEqual([
      expect.objectContaining({ title: 'Updated title', addedAt: 100, updatedAt: 200 }),
    ])
    expect(await repository.getChapters(series.key)).toHaveLength(2)
  })

  it('saves bounded progress and completion', async () => {
    await repository.addOrUpdateSeries(series)
    await repository.saveProgress(series.key, series.chapters[1]!.key, 1.5)
    await repository.saveProgress(series.key, series.chapters[1]!.key, 0.4, true)

    expect(await repository.getChapterProgress(series.chapters[1]!.key)).toMatchObject({
      scrollRatio: 0.4,
      completed: true,
    })
    expect(await repository.getSeriesProgress(series.key)).toMatchObject({
      completedCount: 1,
      chapterCount: 2,
    })
    expect(await repository.listContinueReading()).toEqual([
      expect.objectContaining({
        series: expect.objectContaining({ key: series.key }),
        chapter: expect.objectContaining({ key: series.chapters[0]!.key }),
      }),
    ])
  })

  it('maps legacy merged records to Novel-FR and removes Mangas-Origines-only data', async () => {
    const name = `legacy-${crypto.randomUUID()}`
    const stores = {
      series: '&key, addedAt, updatedAt',
      chapters: '&key, seriesKey, [seriesKey+position]',
      progress: '&chapterKey, seriesKey, lastReadAt, completed',
      downloads: '&chapterKey, seriesKey, downloadedAt',
      covers: '&seriesKey',
    }
    const legacy = new Dexie(name)
    legacy.version(2).stores(stores)
    await legacy.table('series').bulkPut([
      {
        key: '/oeuvre/legacy/',
        title: 'Legacy',
        sources: [
          { source: 'mangasOrigines', key: '/oeuvre/legacy/' },
          { source: 'novelFr', key: 'novelFr:/series/legacy/' },
        ],
      },
      {
        key: '/oeuvre/unmapped/',
        title: 'Unmapped',
        sources: [{ source: 'mangasOrigines', key: '/oeuvre/unmapped/' }],
      },
    ])
    await legacy.table('chapters').put({
      key: '/oeuvre/legacy/chapitre-1/',
      seriesKey: '/oeuvre/legacy/',
      position: 0,
      number: 1,
      releases: [
        { source: 'mangasOrigines', key: '/oeuvre/legacy/chapitre-1/' },
        { source: 'novelFr', key: 'novelFr:/legacy-chapitre-1/' },
      ],
    })
    await legacy.table('progress').put({
      chapterKey: '/oeuvre/legacy/chapitre-1/',
      seriesKey: '/oeuvre/legacy/',
      scrollRatio: 0.6,
      completed: false,
      lastReadAt: 10,
    })
    await legacy.table('downloads').put({
      chapterKey: '/oeuvre/legacy/chapitre-1/',
      seriesKey: '/oeuvre/legacy/',
      title: 'Legacy chapter',
      html: '<p>Fallback copy</p>',
      source: 'mangasOrigines',
      downloadedAt: 10,
    })
    legacy.close()

    const upgraded = new LibraryDatabase(name)
    expect(await upgraded.series.get('novelFr:/series/legacy/')).toMatchObject({
      sources: [{ source: 'novelFr', key: 'novelFr:/series/legacy/' }],
    })
    expect(await upgraded.chapters.get('novelFr:/legacy-chapitre-1/')).toMatchObject({
      seriesKey: 'novelFr:/series/legacy/',
      volume: null,
      releases: [{ source: 'novelFr', key: 'novelFr:/legacy-chapitre-1/' }],
    })
    expect(await upgraded.progress.get('novelFr:/legacy-chapitre-1/')).toMatchObject({ scrollRatio: 0.6 })
    expect(await upgraded.downloads.get('novelFr:/legacy-chapitre-1/')).toBeUndefined()
    expect(await upgraded.series.get('/oeuvre/legacy/')).toBeUndefined()
    expect(await upgraded.series.get('/oeuvre/unmapped/')).toBeUndefined()
    await upgraded.delete()
  })

  it('removes stale chapters and their local data when refreshing', async () => {
    await repository.addOrUpdateSeries(series)
    const staleChapter = series.chapters[1]!
    await repository.saveProgress(series.key, staleChapter.key, 0.5)
    await repository.downloadChapter(series.key, {
      key: staleChapter.key,
      title: staleChapter.title,
      html: '<p>Offline</p>',
      source: 'novelFr',
    })

    await repository.addOrUpdateSeries({ ...series, chapters: [series.chapters[0]!] })

    expect(await repository.getChapter(staleChapter.key)).toBeUndefined()
    expect(await repository.getChapterProgress(staleChapter.key)).toBeUndefined()
    expect(await repository.getDownload(staleChapter.key)).toBeUndefined()
  })

  it('stores downloads and removes all series data', async () => {
    await repository.addOrUpdateSeries(series, new Blob(['cover']))
    await repository.downloadChapter(series.key, {
      key: series.chapters[0]!.key,
      title: 'Chapitre 2',
      html: '<p>Offline</p>',
      source: 'novelFr',
    })

    expect(await repository.getDownload(series.chapters[0]!.key)).toMatchObject({ html: '<p>Offline</p>' })
    await repository.removeSeries(series.key)
    expect(await repository.getSeries(series.key)).toBeUndefined()
    expect(await repository.getDownload(series.chapters[0]!.key)).toBeUndefined()
    expect(await repository.getCover(series.key)).toBeNull()
  })
})
