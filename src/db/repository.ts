import type { SourceChapterContent, SourceSeries } from '../../shared/contracts'
import type { RemoveSeriesOperation, SaveProgressOperation, UpsertSeriesOperation } from '../../shared/sync'
import {
  db,
  type ChapterRecord,
  type DownloadRecord,
  type LibraryDatabase,
  type LibrarySeriesRecord,
  type ReadingProgressRecord,
} from './database'
import { progressSyncKey, seriesSyncKey } from '../sync/keys'
import { scheduleSyncAfterMutation } from '../sync/scheduler'

export interface SeriesProgressSummary {
  current: ReadingProgressRecord | null
  completedCount: number
  chapterCount: number
}

export interface ContinueReadingEntry {
  series: LibrarySeriesRecord
  chapter: ChapterRecord
  lastReadAt: number
}

export class LibraryRepository {
  constructor(private readonly database: LibraryDatabase = db) {}

  async addOrUpdateSeries(series: SourceSeries, cover?: Blob): Promise<void> {
    const now = Date.now()
    await this.database.transaction(
      'rw',
      [
        this.database.series,
        this.database.chapters,
        this.database.progress,
        this.database.downloads,
        this.database.covers,
        this.database.syncQueue,
      ],
      async () => {
        const existing = await this.database.series.get(series.key)
        const record: LibrarySeriesRecord = {
          key: series.key,
          title: series.title,
          sources: series.sources,
          coverImage: series.coverImage,
          author: series.author,
          description: series.description,
          genres: series.genres,
          status: series.status,
          addedAt: existing?.addedAt ?? now,
          updatedAt: now,
        }
        await this.database.series.put(record)
        const currentKeys = await this.database.chapters.where('seriesKey').equals(series.key).primaryKeys()
        const refreshedKeys = new Set(series.chapters.map((chapter) => chapter.key))
        const staleKeys = currentKeys.filter((key) => !refreshedKeys.has(String(key)))
        await this.database.chapters.bulkPut(series.chapters.map((chapter, position) => ({
          ...chapter,
          seriesKey: series.key,
          position,
        })))
        if (staleKeys.length) {
          await Promise.all([
            this.database.chapters.bulkDelete(staleKeys),
            this.database.progress.bulkDelete(staleKeys),
            this.database.downloads.bulkDelete(staleKeys),
            this.database.syncQueue.bulkDelete(staleKeys.map((key) => progressSyncKey(String(key)))),
          ])
        }
        if (cover) await this.database.covers.put({ seriesKey: series.key, blob: cover })
        const operation: UpsertSeriesOperation = {
          operationId: crypto.randomUUID(),
          type: 'upsert-series',
          changedAt: now,
          record: { series, addedAt: record.addedAt, updatedAt: now },
        }
        await this.database.syncQueue.put({
          entityKey: seriesSyncKey(series.key),
          seriesKey: series.key,
          operation,
          queuedAt: now,
        })
      },
    )
    scheduleSyncAfterMutation()
  }

  async removeSeries(seriesKey: string): Promise<void> {
    const now = Date.now()
    await this.database.transaction(
      'rw',
      [
        this.database.series,
        this.database.chapters,
        this.database.progress,
        this.database.downloads,
        this.database.covers,
        this.database.syncQueue,
      ],
      async () => {
        const chapters = await this.database.chapters.where('seriesKey').equals(seriesKey).primaryKeys()
        const operation: RemoveSeriesOperation = {
          operationId: crypto.randomUUID(),
          type: 'remove-series',
          seriesKey,
          changedAt: now,
        }
        await Promise.all([
          this.database.series.delete(seriesKey),
          this.database.chapters.bulkDelete(chapters),
          this.database.progress.where('seriesKey').equals(seriesKey).delete(),
          this.database.downloads.where('seriesKey').equals(seriesKey).delete(),
          this.database.covers.delete(seriesKey),
          this.database.syncQueue.where('seriesKey').equals(seriesKey).delete(),
        ])
        await this.database.syncQueue.put({
          entityKey: seriesSyncKey(seriesKey),
          seriesKey,
          operation,
          queuedAt: now,
        })
      },
    )
    scheduleSyncAfterMutation()
  }

  listSeries(): Promise<LibrarySeriesRecord[]> {
    return this.database.series.orderBy('addedAt').reverse().toArray()
  }

  async listContinueReading(limit = 4): Promise<ContinueReadingEntry[]> {
    const recentProgress = await this.database.progress.orderBy('lastReadAt').reverse().toArray()
    const seenSeries = new Set<string>()
    const entries: ContinueReadingEntry[] = []

    for (const progress of recentProgress) {
      if (seenSeries.has(progress.seriesKey)) continue
      seenSeries.add(progress.seriesKey)

      const [series, currentChapter] = await Promise.all([
        this.database.series.get(progress.seriesKey),
        this.database.chapters.get(progress.chapterKey),
      ])
      if (!series || !currentChapter) continue

      let chapter = currentChapter
      if (progress.completed) {
        if (currentChapter.position === 0) continue
        chapter = await this.database.chapters
          .where('[seriesKey+position]')
          .equals([progress.seriesKey, currentChapter.position - 1])
          .first() ?? currentChapter
      }

      entries.push({ series, chapter, lastReadAt: progress.lastReadAt })
      if (entries.length >= limit) break
    }

    return entries
  }

  getSeries(seriesKey: string): Promise<LibrarySeriesRecord | undefined> {
    return this.database.series.get(seriesKey)
  }

  getChapters(seriesKey: string) {
    return this.database.chapters.where('seriesKey').equals(seriesKey).sortBy('position')
  }

  getChapter(chapterKey: string) {
    return this.database.chapters.get(chapterKey)
  }

  async getCover(seriesKey: string): Promise<Blob | null> {
    return (await this.database.covers.get(seriesKey))?.blob ?? null
  }

  async saveProgress(
    seriesKey: string,
    chapterKey: string,
    scrollRatio: number,
    completed = false,
  ): Promise<void> {
    const now = Date.now()
    await this.database.transaction('rw', this.database.progress, this.database.syncQueue, async () => {
      const previous = await this.database.progress.get(chapterKey)
      const record: ReadingProgressRecord = {
        seriesKey,
        chapterKey,
        scrollRatio: Math.max(0, Math.min(1, scrollRatio)),
        completed: completed || previous?.completed || false,
        lastReadAt: now,
      }
      const operation: SaveProgressOperation = {
        operationId: crypto.randomUUID(),
        type: 'save-progress',
        record,
      }
      await Promise.all([
        this.database.progress.put(record),
        this.database.syncQueue.put({
          entityKey: progressSyncKey(chapterKey),
          seriesKey,
          operation,
          queuedAt: now,
        }),
      ])
    })
    scheduleSyncAfterMutation()
  }

  getChapterProgress(chapterKey: string): Promise<ReadingProgressRecord | undefined> {
    return this.database.progress.get(chapterKey)
  }

  getSeriesProgressEntries(seriesKey: string): Promise<ReadingProgressRecord[]> {
    return this.database.progress.where('seriesKey').equals(seriesKey).toArray()
  }

  async getSeriesProgress(seriesKey: string): Promise<SeriesProgressSummary> {
    const [progress, chapterCount] = await Promise.all([
      this.database.progress.where('seriesKey').equals(seriesKey).toArray(),
      this.database.chapters.where('seriesKey').equals(seriesKey).count(),
    ])
    const current = progress.sort((left, right) => right.lastReadAt - left.lastReadAt)[0] ?? null
    return {
      current,
      completedCount: progress.filter((entry) => entry.completed).length,
      chapterCount,
    }
  }

  async downloadChapter(seriesKey: string, content: SourceChapterContent): Promise<void> {
    await this.database.downloads.put({
      chapterKey: content.key,
      seriesKey,
      title: content.title,
      html: content.html,
      source: content.source,
      downloadedAt: Date.now(),
    })
  }

  getDownload(chapterKey: string): Promise<DownloadRecord | undefined> {
    return this.database.downloads.get(chapterKey)
  }

  removeDownload(chapterKey: string): Promise<void> {
    return this.database.downloads.delete(chapterKey)
  }

  async downloadedChapterKeys(seriesKey: string): Promise<Set<string>> {
    const records = await this.database.downloads.where('seriesKey').equals(seriesKey).toArray()
    return new Set(records.map((record) => record.chapterKey))
  }
}

export const libraryRepository = new LibraryRepository()
