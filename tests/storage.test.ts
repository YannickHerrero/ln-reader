import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SourceSeries } from '../shared/contracts'
import { LibraryDatabase } from '../src/db/database'
import { LibraryRepository } from '../src/db/repository'

const series: SourceSeries = {
  key: '/oeuvre/example/',
  title: 'Example Novel',
  coverImage: null,
  author: 'Jane Doe',
  description: 'Synopsis',
  genres: ['Novel'],
  status: 'En cours',
  chapters: [
    { key: '/oeuvre/example/chapitre-2/', title: 'Chapitre 2', number: 2, publishedAt: null },
    { key: '/oeuvre/example/chapitre-1/', title: 'Chapitre 1', number: 1, publishedAt: null },
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
  })

  it('stores downloads and removes all series data', async () => {
    await repository.addOrUpdateSeries(series, new Blob(['cover']))
    await repository.downloadChapter(series.key, {
      key: series.chapters[0]!.key,
      title: 'Chapitre 2',
      html: '<p>Offline</p>',
    })

    expect(await repository.getDownload(series.chapters[0]!.key)).toMatchObject({ html: '<p>Offline</p>' })
    await repository.removeSeries(series.key)
    expect(await repository.getSeries(series.key)).toBeUndefined()
    expect(await repository.getDownload(series.chapters[0]!.key)).toBeUndefined()
    expect(await repository.getCover(series.key)).toBeNull()
  })
})
