import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SourceSeries } from '../shared/contracts'
import { LibraryDatabase } from '../src/db/database'
import { LibraryRepository } from '../src/db/repository'

const series: SourceSeries = {
  key: '/oeuvre/example/',
  title: 'Example Novel',
  sources: [{ source: 'mangasOrigines', key: '/oeuvre/example/' }],
  coverImage: null,
  author: 'Jane Doe',
  description: 'Synopsis',
  genres: ['Novel'],
  status: 'En cours',
  chapters: [
    { key: '/oeuvre/example/chapitre-2/', title: 'Chapitre 2', number: 2, publishedAt: null, releases: [{ source: 'mangasOrigines', key: '/oeuvre/example/chapitre-2/' }] },
    { key: '/oeuvre/example/chapitre-1/', title: 'Chapitre 1', number: 1, publishedAt: null, releases: [{ source: 'mangasOrigines', key: '/oeuvre/example/chapitre-1/' }] },
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

  it('migrates existing Mangas-Origines records to source-aware data', async () => {
    const name = `legacy-${crypto.randomUUID()}`
    const legacy = new Dexie(name)
    legacy.version(1).stores({
      series: '&key, addedAt, updatedAt',
      chapters: '&key, seriesKey, [seriesKey+position]',
      progress: '&chapterKey, seriesKey, lastReadAt, completed',
      downloads: '&chapterKey, seriesKey, downloadedAt',
      covers: '&seriesKey',
    })
    await legacy.table('series').put({ key: '/oeuvre/legacy/', title: 'Legacy' })
    await legacy.table('chapters').put({ key: '/oeuvre/legacy/chapitre-1/', seriesKey: '/oeuvre/legacy/', position: 0 })
    legacy.close()

    const upgraded = new LibraryDatabase(name)
    expect(await upgraded.series.get('/oeuvre/legacy/')).toMatchObject({
      sources: [{ source: 'mangasOrigines', key: '/oeuvre/legacy/' }],
    })
    expect(await upgraded.chapters.get('/oeuvre/legacy/chapitre-1/')).toMatchObject({
      releases: [{ source: 'mangasOrigines', key: '/oeuvre/legacy/chapitre-1/' }],
    })
    await upgraded.delete()
  })

  it('stores downloads and removes all series data', async () => {
    await repository.addOrUpdateSeries(series, new Blob(['cover']))
    await repository.downloadChapter(series.key, {
      key: series.chapters[0]!.key,
      title: 'Chapitre 2',
      html: '<p>Offline</p>',
      source: 'mangasOrigines',
    })

    expect(await repository.getDownload(series.chapters[0]!.key)).toMatchObject({ html: '<p>Offline</p>' })
    await repository.removeSeries(series.key)
    expect(await repository.getSeries(series.key)).toBeUndefined()
    expect(await repository.getDownload(series.chapters[0]!.key)).toBeUndefined()
    expect(await repository.getCover(series.key)).toBeNull()
  })
})
