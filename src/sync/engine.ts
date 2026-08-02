import type { SourceSeries } from '../../shared/contracts'
import type { SyncState, SyncedSeriesRecord, UpsertSeriesOperation, SaveProgressOperation } from '../../shared/sync'
import type { SyncTransport } from '../api/sync'
import {
  type ChapterRecord,
  type LibraryDatabase,
  type LibrarySeriesRecord,
  type SyncQueueRecord,
} from '../db/database'
import { progressSyncKey, seriesSyncKey } from './keys'

const BOOTSTRAP_KEY = 'server-sync-bootstrap-v1'
const REVISION_KEY = 'server-sync-revision'
const LAST_SYNCED_AT_KEY = 'server-sync-last-synced-at'

export type CoverFetcher = (url: string) => Promise<Blob>

function sourceSeries(record: LibrarySeriesRecord, chapters: ChapterRecord[]): SourceSeries {
  return {
    key: record.key,
    title: record.title,
    sources: record.sources,
    coverImage: record.coverImage,
    author: record.author,
    description: record.description,
    genres: record.genres,
    status: record.status,
    chapters: chapters.map((chapter) => ({
      key: chapter.key,
      title: chapter.title,
      number: chapter.number,
      volume: chapter.volume,
      publishedAt: chapter.publishedAt,
      releases: chapter.releases,
    })),
  }
}

function libraryRecord(record: SyncedSeriesRecord): LibrarySeriesRecord {
  return {
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
}

export class SyncEngine {
  private inFlight: Promise<SyncState> | null = null

  constructor(
    private readonly database: LibraryDatabase,
    private readonly transport: SyncTransport,
    private readonly coverFetcher?: CoverFetcher,
    private readonly now: () => number = Date.now,
  ) {}

  synchronize(): Promise<SyncState> {
    if (this.inFlight) return this.inFlight
    this.inFlight = this.run().finally(() => {
      this.inFlight = null
    })
    return this.inFlight
  }

  private async run(): Promise<SyncState> {
    await this.bootstrapExistingState()
    const queued = await this.database.syncQueue.orderBy('queuedAt').toArray()
    const state = queued.length > 0
      ? await this.transport.push(queued.map((record) => record.operation))
      : await this.transport.pull()
    await this.reconcile(state, queued)
    void this.hydrateMissingCovers(state)
    return state
  }

  private async bootstrapExistingState(): Promise<void> {
    await this.database.transaction(
      'rw',
      this.database.series,
      this.database.chapters,
      this.database.progress,
      this.database.syncQueue,
      this.database.syncMetadata,
      async () => {
        const existing = await this.database.syncMetadata.get(BOOTSTRAP_KEY)
        if (existing?.value === true) return

        const seriesRecords = await this.database.series.toArray()
        for (const record of seriesRecords) {
          const entityKey = seriesSyncKey(record.key)
          if (await this.database.syncQueue.get(entityKey)) continue
          const chapters = await this.database.chapters.where('seriesKey').equals(record.key).sortBy('position')
          const operation: UpsertSeriesOperation = {
            operationId: crypto.randomUUID(),
            type: 'upsert-series',
            changedAt: record.updatedAt,
            record: {
              series: sourceSeries(record, chapters),
              addedAt: record.addedAt,
              updatedAt: record.updatedAt,
            },
          }
          await this.database.syncQueue.put({
            entityKey,
            seriesKey: record.key,
            operation,
            queuedAt: record.updatedAt,
          })
        }

        const progressRecords = await this.database.progress.toArray()
        for (const progress of progressRecords) {
          const entityKey = progressSyncKey(progress.chapterKey)
          if (await this.database.syncQueue.get(entityKey)) continue
          const operation: SaveProgressOperation = {
            operationId: crypto.randomUUID(),
            type: 'save-progress',
            record: progress,
          }
          await this.database.syncQueue.put({
            entityKey,
            seriesKey: progress.seriesKey,
            operation,
            queuedAt: progress.lastReadAt,
          })
        }

        await this.database.syncMetadata.put({ key: BOOTSTRAP_KEY, value: true })
      },
    )
  }

  private async reconcile(state: SyncState, sentQueue: SyncQueueRecord[]): Promise<void> {
    await this.database.transaction(
      'rw',
      [
        this.database.series,
        this.database.chapters,
        this.database.progress,
        this.database.downloads,
        this.database.covers,
        this.database.syncQueue,
        this.database.syncMetadata,
      ],
      async () => {
        for (const sent of sentQueue) {
          const current = await this.database.syncQueue.get(sent.entityKey)
          if (current?.operation.operationId === sent.operation.operationId) {
            await this.database.syncQueue.delete(sent.entityKey)
          }
        }

        const currentRevision = Number((await this.database.syncMetadata.get(REVISION_KEY))?.value ?? 0)
        if (state.revision < currentRevision) return

        const remainingQueue = await this.database.syncQueue.toArray()
        const protectedSeries = new Set(
          remainingQueue
            .filter((record) => record.operation.type !== 'save-progress')
            .map((record) => record.seriesKey),
        )
        const protectedProgress = new Set(
          remainingQueue
            .filter((record) => record.operation.type === 'save-progress')
            .map((record) => record.entityKey),
        )
        const serverSeries = new Map(state.series.map((record) => [record.series.key, record]))
        const serverProgress = new Map(state.progress.map((record) => [record.chapterKey, record]))

        for (const record of state.series) {
          const seriesKey = record.series.key
          if (protectedSeries.has(seriesKey)) continue
          await this.database.series.put(libraryRecord(record))
          const localChapterKeys = await this.database.chapters.where('seriesKey').equals(seriesKey).primaryKeys()
          const incomingKeys = new Set(record.series.chapters.map((chapter) => chapter.key))
          const staleKeys = localChapterKeys.filter((key) => !incomingKeys.has(String(key)))
          await this.database.chapters.bulkPut(record.series.chapters.map((chapter, position) => ({
            ...chapter,
            seriesKey,
            position,
          })))
          if (staleKeys.length > 0) {
            await Promise.all([
              this.database.chapters.bulkDelete(staleKeys),
              this.database.progress.bulkDelete(staleKeys),
              this.database.downloads.bulkDelete(staleKeys),
              this.database.syncQueue.bulkDelete(staleKeys.map((key) => progressSyncKey(String(key)))),
            ])
          }
        }

        const localSeriesKeys = await this.database.series.toCollection().primaryKeys()
        for (const key of localSeriesKeys.map(String)) {
          if (serverSeries.has(key) || protectedSeries.has(key)) continue
          const chapterKeys = await this.database.chapters.where('seriesKey').equals(key).primaryKeys()
          await Promise.all([
            this.database.series.delete(key),
            this.database.chapters.bulkDelete(chapterKeys),
            this.database.progress.where('seriesKey').equals(key).delete(),
            this.database.downloads.where('seriesKey').equals(key).delete(),
            this.database.covers.delete(key),
            this.database.syncQueue.where('seriesKey').equals(key).delete(),
          ])
        }

        for (const progress of state.progress) {
          if (protectedSeries.has(progress.seriesKey)
            || protectedProgress.has(progressSyncKey(progress.chapterKey))) continue
          if (await this.database.chapters.get(progress.chapterKey)) {
            await this.database.progress.put(progress)
          }
        }

        const localProgress = await this.database.progress.toArray()
        for (const progress of localProgress) {
          if (serverProgress.has(progress.chapterKey)
            || protectedSeries.has(progress.seriesKey)
            || protectedProgress.has(progressSyncKey(progress.chapterKey))) continue
          await this.database.progress.delete(progress.chapterKey)
        }

        await this.database.syncMetadata.bulkPut([
          { key: REVISION_KEY, value: state.revision },
          { key: LAST_SYNCED_AT_KEY, value: this.now() },
        ])
      },
    )
  }

  private async hydrateMissingCovers(state: SyncState): Promise<void> {
    if (!this.coverFetcher) return
    await Promise.allSettled(state.series.map(async ({ series }) => {
      if (!series.coverImage || await this.database.covers.get(series.key)) return
      const blob = await this.coverFetcher!(series.coverImage)
      await this.database.covers.put({ seriesKey: series.key, blob })
    }))
  }
}
