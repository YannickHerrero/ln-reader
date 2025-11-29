import Dexie, { type EntityTable } from 'dexie'
import type { EpubMetadata, EpubFile, ReadingProgress } from './types'

const db = new Dexie('LNReaderDB') as Dexie & {
  metadata: EntityTable<EpubMetadata, 'id'>
  files: EntityTable<EpubFile, 'id'>
  progress: EntityTable<ReadingProgress, 'id'>
}

db.version(1).stores({
  metadata: '++id, title, author, addedAt, lastReadAt',
  files: '++id, metadataId',
})

db.version(2).stores({
  metadata: '++id, title, author, addedAt, lastReadAt',
  files: '++id, metadataId',
  progress: '++id, &metadataId',
})

// Version 3: Add character-based progress tracking
// New fields: exploredCharCount, bookCharCount, progress
// pageIndex is deprecated but kept for backwards compatibility
db.version(3).stores({
  metadata: '++id, title, author, addedAt, lastReadAt',
  files: '++id, metadataId',
  progress: '++id, &metadataId',
}).upgrade(async (tx) => {
  // Migrate old progress records to use character count
  // Default to 0 for exploredCharCount if not present
  await tx.table('progress').toCollection().modify((progress) => {
    if (progress.exploredCharCount === undefined) {
      progress.exploredCharCount = 0
      progress.bookCharCount = 0
      progress.progress = 0
    }
  })
})

export { db }
export type { EpubMetadata, EpubFile, ReadingProgress }
