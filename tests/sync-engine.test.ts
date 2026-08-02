import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SyncOperation, SyncState, SyncedSeriesRecord } from '../shared/sync'
import type { SyncTransport } from '../src/api/sync'
import { LibraryDatabase, type LibrarySeriesRecord } from '../src/db/database'
import { SyncEngine } from '../src/sync/engine'

const localSeries: SyncedSeriesRecord = {
  series: {
    key: 'novelFr:/series/local/',
    title: 'Local Novel',
    sources: [{ source: 'novelFr', key: 'novelFr:/series/local/' }],
    coverImage: 'https://example.test/local.jpg',
    author: null,
    description: null,
    genres: ['Novel'],
    status: null,
    chapters: [{
      key: 'novelFr:/chapter/local-1/',
      title: 'Local Chapter',
      number: 1,
      volume: null,
      publishedAt: null,
      releases: [{ source: 'novelFr', key: 'novelFr:/chapter/local-1/' }],
    }],
  },
  addedAt: 100,
  updatedAt: 200,
}

const remoteSeries: SyncedSeriesRecord = {
  series: {
    ...localSeries.series,
    key: 'novelFr:/series/remote/',
    title: 'Remote Novel',
    sources: [{ source: 'novelFr', key: 'novelFr:/series/remote/' }],
    coverImage: 'https://example.test/remote.jpg',
    chapters: [{
      ...localSeries.series.chapters[0]!,
      key: 'novelFr:/chapter/remote-1/',
      title: 'Remote Chapter',
      releases: [{ source: 'novelFr', key: 'novelFr:/chapter/remote-1/' }],
    }],
  },
  addedAt: 300,
  updatedAt: 300,
}

class FakeTransport implements SyncTransport {
  pushed: SyncOperation[] = []

  constructor(
    private readonly state: SyncState,
    private readonly failure?: Error,
  ) {}

  async pull(): Promise<SyncState> {
    if (this.failure) throw this.failure
    return this.state
  }

  async push(operations: SyncOperation[]): Promise<SyncState> {
    this.pushed = operations
    if (this.failure) throw this.failure
    return this.state
  }
}

let database: LibraryDatabase

beforeEach(() => {
  database = new LibraryDatabase(`sync-engine-${crypto.randomUUID()}`)
})

afterEach(async () => {
  await database.delete()
  vi.restoreAllMocks()
})

async function seedSeries(record: SyncedSeriesRecord) {
  const libraryRecord: LibrarySeriesRecord = {
    key: record.series.key,
    title: record.series.title,
    sources: record.series.sources,
    coverImage: record.series.coverImage,
    author: record.series.author,
    description: record.series.description,
    genres: record.series.genres,
    status: record.series.status,
    addedAt: record.addedAt,
    updatedAt: record.updatedAt,
  }
  await database.series.put(libraryRecord)
  await database.chapters.bulkPut(record.series.chapters.map((chapter, position) => ({
    ...chapter,
    seriesKey: record.series.key,
    position,
  })))
}

describe('sync engine', () => {
  it('bootstraps existing device state and merges the server response', async () => {
    await seedSeries(localSeries)
    await database.progress.put({
      seriesKey: localSeries.series.key,
      chapterKey: localSeries.series.chapters[0]!.key,
      scrollRatio: 0.4,
      completed: false,
      lastReadAt: 250,
    })
    await database.downloads.put({
      seriesKey: localSeries.series.key,
      chapterKey: localSeries.series.chapters[0]!.key,
      title: 'Offline copy',
      html: '<p>Offline</p>',
      source: 'novelFr',
      downloadedAt: 260,
    })
    const transport = new FakeTransport({
      revision: 1,
      series: [localSeries, remoteSeries],
      progress: [{
        seriesKey: localSeries.series.key,
        chapterKey: localSeries.series.chapters[0]!.key,
        scrollRatio: 0.4,
        completed: false,
        lastReadAt: 250,
      }],
    })
    const coverFetcher = vi.fn().mockResolvedValue(new Blob(['cover']))

    await new SyncEngine(database, transport, coverFetcher, () => 500).synchronize()

    expect(transport.pushed.map((operation) => operation.type)).toEqual(['upsert-series', 'save-progress'])
    expect(await database.series.get(remoteSeries.series.key)).toMatchObject({ title: 'Remote Novel' })
    expect(await database.downloads.get(localSeries.series.chapters[0]!.key)).toMatchObject({ html: '<p>Offline</p>' })
    await vi.waitFor(async () => expect(await database.covers.get(remoteSeries.series.key)).toBeDefined())
    expect(await database.syncQueue.count()).toBe(0)
    expect(await database.syncMetadata.get('server-sync-revision')).toMatchObject({ value: 1 })
  })

  it('keeps local state and queued operations after a network failure', async () => {
    await seedSeries(localSeries)
    await database.syncQueue.put({
      entityKey: `series:${localSeries.series.key}`,
      seriesKey: localSeries.series.key,
      operation: {
        operationId: 'pending',
        type: 'upsert-series',
        changedAt: localSeries.updatedAt,
        record: localSeries,
      },
      queuedAt: localSeries.updatedAt,
    })
    await database.syncMetadata.put({ key: 'server-sync-bootstrap-v1', value: true })
    const engine = new SyncEngine(
      database,
      new FakeTransport({ revision: 0, series: [], progress: [] }, new Error('Offline')),
    )

    await expect(engine.synchronize()).rejects.toThrow('Offline')

    expect(await database.series.get(localSeries.series.key)).toBeDefined()
    expect(await database.syncQueue.get(`series:${localSeries.series.key}`)).toBeDefined()
  })

  it('applies remote removals and clears device-local files for removed library entries', async () => {
    await seedSeries(localSeries)
    await database.downloads.put({
      seriesKey: localSeries.series.key,
      chapterKey: localSeries.series.chapters[0]!.key,
      title: 'Offline copy',
      html: '<p>Offline</p>',
      source: 'novelFr',
      downloadedAt: 260,
    })
    await database.covers.put({ seriesKey: localSeries.series.key, blob: new Blob(['cover']) })
    await database.syncMetadata.bulkPut([
      { key: 'server-sync-bootstrap-v1', value: true },
      { key: 'server-sync-revision', value: 1 },
    ])

    await new SyncEngine(
      database,
      new FakeTransport({ revision: 2, series: [], progress: [] }),
    ).synchronize()

    expect(await database.series.get(localSeries.series.key)).toBeUndefined()
    expect(await database.downloads.count()).toBe(0)
    expect(await database.covers.count()).toBe(0)
  })

  it('does not apply an older response over a newer local revision', async () => {
    await seedSeries(localSeries)
    await database.syncMetadata.bulkPut([
      { key: 'server-sync-bootstrap-v1', value: true },
      { key: 'server-sync-revision', value: 5 },
    ])

    await new SyncEngine(
      database,
      new FakeTransport({ revision: 4, series: [], progress: [] }),
    ).synchronize()

    expect(await database.series.get(localSeries.series.key)).toBeDefined()
    expect(await database.syncMetadata.get('server-sync-revision')).toMatchObject({ value: 5 })
  })
})
