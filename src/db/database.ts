import Dexie, { type EntityTable } from 'dexie'
import type { SourceChapter, SourceSeries } from '../../shared/contracts'

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
    this.version(1).stores({
      series: '&key, addedAt, updatedAt',
      chapters: '&key, seriesKey, [seriesKey+position]',
      progress: '&chapterKey, seriesKey, lastReadAt, completed',
      downloads: '&chapterKey, seriesKey, downloadedAt',
      covers: '&seriesKey',
    })
  }
}

export const db = new LibraryDatabase()
