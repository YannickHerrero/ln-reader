export interface EpubMetadata {
  id?: number
  title: string
  author: string
  coverUrl: string | null
  addedAt: Date
  lastReadAt: Date | null
}

export interface EpubFile {
  id?: number
  metadataId: number
  blob: Blob
}

export interface ReadingProgress {
  id?: number
  metadataId: number
  chapterIndex: number
  /** @deprecated Use exploredCharCount instead */
  pageIndex?: number
  /** Number of characters read in current chapter */
  exploredCharCount: number
  /** Total characters in book (for calculating progress) */
  bookCharCount: number
  /** Progress ratio (0-1) */
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
