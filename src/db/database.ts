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
  }
}

export const db = new LibraryDatabase()
