import Dexie, { type EntityTable } from 'dexie'
import type { SourceChapter, SourceID, SourceSeries } from '../../shared/contracts'

export interface LibrarySeriesRecord extends Omit<SourceSeries, 'chapters'> {
  addedAt: number
  updatedAt: number
}

export interface ChapterRecord extends SourceChapter {
  seriesKey: string
  position: number
}

export interface ReadingProgressRecord {
  chapterKey: string
  seriesKey: string
  scrollRatio: number
  completed: boolean
  lastReadAt: number
}

export interface DownloadRecord {
  chapterKey: string
  seriesKey: string
  title: string
  html: string
  source?: SourceID
  downloadedAt: number
}

export interface CoverRecord {
  seriesKey: string
  blob: Blob
}

export class LibraryDatabase extends Dexie {
  series!: EntityTable<LibrarySeriesRecord, 'key'>
  chapters!: EntityTable<ChapterRecord, 'key'>
  progress!: EntityTable<ReadingProgressRecord, 'chapterKey'>
  downloads!: EntityTable<DownloadRecord, 'chapterKey'>
  covers!: EntityTable<CoverRecord, 'seriesKey'>

  constructor(name = 'ln-reader') {
    super(name)
    const stores = {
      series: '&key, addedAt, updatedAt',
      chapters: '&key, seriesKey, [seriesKey+position]',
      progress: '&chapterKey, seriesKey, lastReadAt, completed',
      downloads: '&chapterKey, seriesKey, downloadedAt',
      covers: '&seriesKey',
    }
    this.version(1).stores(stores)
    this.version(2).stores(stores).upgrade(async (transaction) => {
      await transaction.table('series').toCollection().modify((record) => {
        record.sources ??= [{ source: 'mangasOrigines', key: record.key }]
      })
      await transaction.table('chapters').toCollection().modify((record) => {
        record.releases ??= [{ source: 'mangasOrigines', key: record.key }]
      })
      await transaction.table('downloads').toCollection().modify((record) => {
        record.source ??= record.chapterKey.startsWith('novelFr:') ? 'novelFr' : 'mangasOrigines'
      })
    })
    this.version(3).stores(stores).upgrade(async (transaction) => {
      const seriesTable = transaction.table('series')
      const chapterTable = transaction.table('chapters')
      const progressTable = transaction.table('progress')
      const downloadTable = transaction.table('downloads')
      const coverTable = transaction.table('covers')
      const legacySeries = await seriesTable.toArray()

      for (const record of legacySeries) {
        const novelReference = record.sources?.find((reference: { source: string }) => reference.source === 'novelFr')
          ?? (String(record.key).startsWith('novelFr:') ? { source: 'novelFr', key: record.key } : null)
        const oldSeriesKey = String(record.key)

        if (!novelReference) {
          await Promise.all([
            seriesTable.delete(oldSeriesKey),
            chapterTable.where('seriesKey').equals(oldSeriesKey).delete(),
            progressTable.where('seriesKey').equals(oldSeriesKey).delete(),
            downloadTable.where('seriesKey').equals(oldSeriesKey).delete(),
            coverTable.delete(oldSeriesKey),
          ])
          continue
        }

        const newSeriesKey = String(novelReference.key)
        const existingSeries = newSeriesKey === oldSeriesKey ? null : await seriesTable.get(newSeriesKey)
        await seriesTable.put({
          ...record,
          ...existingSeries,
          key: newSeriesKey,
          sources: [{ source: 'novelFr', key: newSeriesKey }],
        })

        const legacyChapters = await chapterTable.where('seriesKey').equals(oldSeriesKey).toArray()
        for (const chapter of legacyChapters) {
          const novelRelease = chapter.releases?.find((release: { source: string }) => release.source === 'novelFr')
            ?? (String(chapter.key).startsWith('novelFr:') ? { source: 'novelFr', key: chapter.key } : null)
          const oldChapterKey = String(chapter.key)
          if (!novelRelease) {
            await Promise.all([
              chapterTable.delete(oldChapterKey),
              progressTable.delete(oldChapterKey),
              downloadTable.delete(oldChapterKey),
            ])
            continue
          }

          const newChapterKey = String(novelRelease.key)
          const existingChapter = newChapterKey === oldChapterKey ? null : await chapterTable.get(newChapterKey)
          await chapterTable.put({
            ...chapter,
            ...existingChapter,
            key: newChapterKey,
            seriesKey: newSeriesKey,
            volume: existingChapter?.volume ?? chapter.volume ?? null,
            releases: [{ source: 'novelFr', key: newChapterKey }],
          })

          const oldProgress = await progressTable.get(oldChapterKey)
          if (oldProgress) {
            const targetProgress = newChapterKey === oldChapterKey ? null : await progressTable.get(newChapterKey)
            if (!targetProgress || oldProgress.lastReadAt > targetProgress.lastReadAt) {
              await progressTable.put({ ...oldProgress, chapterKey: newChapterKey, seriesKey: newSeriesKey })
            }
          }

          const oldDownload = await downloadTable.get(oldChapterKey)
          if (oldDownload?.source === 'novelFr') {
            await downloadTable.put({ ...oldDownload, chapterKey: newChapterKey, seriesKey: newSeriesKey, source: 'novelFr' })
          } else if (oldDownload) {
            await downloadTable.delete(oldChapterKey)
          }

          if (newChapterKey !== oldChapterKey) {
            await Promise.all([
              chapterTable.delete(oldChapterKey),
              progressTable.delete(oldChapterKey),
              downloadTable.delete(oldChapterKey),
            ])
          }
        }

        if (newSeriesKey !== oldSeriesKey) {
          const cover = await coverTable.get(oldSeriesKey)
          if (cover && !(await coverTable.get(newSeriesKey))) {
            await coverTable.put({ ...cover, seriesKey: newSeriesKey })
          }
          await Promise.all([seriesTable.delete(oldSeriesKey), coverTable.delete(oldSeriesKey)])
        }
      }
    })
  }
}

export const db = new LibraryDatabase()
