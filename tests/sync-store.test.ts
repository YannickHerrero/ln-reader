import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { SyncOperation, SyncedSeriesRecord } from '../shared/sync'
import { SqliteSyncStore } from '../server/sync-store'

const stores: SqliteSyncStore[] = []
const temporaryDirectories: string[] = []

const seriesRecord: SyncedSeriesRecord = {
  series: {
    key: 'novelFr:/series/example/',
    title: 'Example',
    sources: [{ source: 'novelFr', key: 'novelFr:/series/example/' }],
    coverImage: null,
    author: 'Author',
    description: 'Description',
    genres: ['Novel'],
    status: 'En cours',
    chapters: [
      {
        key: 'novelFr:/chapter/1/',
        title: 'Chapitre 1',
        number: 1,
        volume: null,
        publishedAt: null,
        releases: [{ source: 'novelFr', key: 'novelFr:/chapter/1/' }],
      },
      {
        key: 'novelFr:/chapter/2/',
        title: 'Chapitre 2',
        number: 2,
        volume: null,
        publishedAt: null,
        releases: [{ source: 'novelFr', key: 'novelFr:/chapter/2/' }],
      },
    ],
  },
  addedAt: 100,
  updatedAt: 100,
}

function createStore(path = ':memory:') {
  const store = new SqliteSyncStore(path)
  stores.push(store)
  return store
}

function upsert(id: string, changedAt: number, record = seriesRecord): SyncOperation {
  return { operationId: id, type: 'upsert-series', changedAt, record }
}

function progress(id: string, lastReadAt: number, scrollRatio: number, completed = false): SyncOperation {
  return {
    operationId: id,
    type: 'save-progress',
    record: {
      seriesKey: seriesRecord.series.key,
      chapterKey: seriesRecord.series.chapters[0]!.key,
      scrollRatio,
      completed,
      lastReadAt,
    },
  }
}

afterEach(() => {
  for (const store of stores.splice(0)) {
    try { store.close() } catch { /* already closed by the test */ }
  }
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('SQLite sync store', () => {
  it('persists synchronized state and ignores retried operations', () => {
    const directory = mkdtempSync(join(tmpdir(), 'lyra-sync-'))
    temporaryDirectories.push(directory)
    const path = join(directory, 'state.sqlite')
    const store = createStore(path)
    const operations = [upsert('series-1', 100), progress('progress-1', 200, 0.4)]

    expect(store.applyOperations(operations)).toMatchObject({ revision: 1 })
    expect(store.applyOperations(operations)).toMatchObject({ revision: 1 })
    store.close()
    stores.splice(stores.indexOf(store), 1)

    const reopened = createStore(path)
    expect(reopened.getState()).toMatchObject({
      revision: 1,
      series: [{ series: { title: 'Example' } }],
      progress: [{ scrollRatio: 0.4, completed: false }],
    })
  })

  it('keeps the latest position while completion remains monotonic', () => {
    const store = createStore()
    store.applyOperations([upsert('series', 100), progress('newer', 300, 0.8)])
    store.applyOperations([progress('older-complete', 200, 0.2, true)])

    expect(store.getState().progress[0]).toMatchObject({ scrollRatio: 0.8, completed: true, lastReadAt: 300 })

    store.applyOperations([progress('latest', 400, 0.25)])
    expect(store.getState().progress[0]).toMatchObject({ scrollRatio: 0.25, completed: true, lastReadAt: 400 })
  })

  it('uses tombstones to prevent stale devices from restoring removed series', () => {
    const store = createStore()
    store.applyOperations([upsert('series', 100), progress('progress', 150, 0.5)])
    store.applyOperations([{
      operationId: 'remove',
      type: 'remove-series',
      seriesKey: seriesRecord.series.key,
      changedAt: 300,
    }])
    store.applyOperations([
      upsert('stale-series', 200, { ...seriesRecord, updatedAt: 200 }),
      progress('stale-progress', 250, 0.9),
    ])

    expect(store.getState()).toMatchObject({ series: [], progress: [] })

    store.applyOperations([upsert('readded', 400, { ...seriesRecord, addedAt: 400, updatedAt: 400 })])
    expect(store.getState()).toMatchObject({
      series: [{ addedAt: 400 }],
      progress: [],
    })
  })

  it('removes progress for chapters dropped by a newer series snapshot', () => {
    const store = createStore()
    store.applyOperations([upsert('series', 100), progress('progress', 150, 0.5)])
    const refreshed = {
      ...seriesRecord,
      series: { ...seriesRecord.series, chapters: [seriesRecord.series.chapters[1]!] },
      updatedAt: 200,
    }

    store.applyOperations([upsert('refresh', 200, refreshed)])

    expect(store.getState().progress).toEqual([])
  })
})
