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
  pageIndex: number
  lastRead: Date
}
