export interface EpubMetadata {
  id?: number
  title: string
  author: string
  language?: string
  coverUrl: string | null
  addedAt: Date
  lastReadAt: Date | null
  /** Character count per chapter (calculated at import time) */
  chapterCharCounts?: number[]
  /** Total character count for the entire book */
  totalCharCount?: number
}

/** @deprecated Use ProcessedBook instead */
export interface EpubFile {
  id?: number
  metadataId: number
  blob: Blob
}

/** Pre-processed chapter data stored in IndexedDB */
export interface ProcessedChapter {
  /** Chapter ID/href from EPUB */
  id: string
  /** Processed HTML content (with dummy image URLs) */
  html: string
  /** Character count for this chapter */
  charCount: number
  /** Chapter title if available */
  title?: string
}

/** Pre-processed book data stored in IndexedDB */
export interface ProcessedBook {
  id?: number
  metadataId: number
  /** Pre-processed HTML per chapter (with dummy image URLs) */
  chapters: ProcessedChapter[]
  /** Scoped CSS stylesheet */
  styleSheet: string
  /** Image blobs keyed by path */
  blobs: Record<string, Blob>
}

export interface ReadingProgress {
  id?: number
  metadataId: number
  chapterIndex: number
  /** @deprecated Use exploredCharCount instead */
  pageIndex?: number
  /** Number of characters read in current chapter */
  exploredCharCount: number
  /** Total characters in current chapter */
  bookCharCount: number
  /** Whole-book progress ratio (0-1), based on chapter position */
  progress: number
  lastRead: Date
}

export interface DictionaryEntry {
  id?: number
  word: string
  reading: string
  reading2: string
  reading3: string
  frequency: number
  definitions: string[]
  jmdictId: number
}

export interface DictionaryMeta {
  id?: number
  key: string
  value: string
}
