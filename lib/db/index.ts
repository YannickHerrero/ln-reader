import Dexie, { type EntityTable } from 'dexie'
import type {
  EpubMetadata,
  EpubFile,
  ProcessedBook,
  ReadingProgress,
  DictionaryEntry,
  DictionaryMeta,
} from './types'

const db = new Dexie('LNReaderDB') as Dexie & {
  metadata: EntityTable<EpubMetadata, 'id'>
  files: EntityTable<EpubFile, 'id'>
  processedBooks: EntityTable<ProcessedBook, 'id'>
  progress: EntityTable<ReadingProgress, 'id'>
  dictionary: EntityTable<DictionaryEntry, 'id'>
  dictionaryMeta: EntityTable<DictionaryMeta, 'id'>
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

// Version 4: Add dictionary tables for JMDict lookup
db.version(4).stores({
  metadata: '++id, title, author, addedAt, lastReadAt',
  files: '++id, metadataId',
  progress: '++id, &metadataId',
  dictionary: '++id, word, reading, reading2, reading3, frequency',
  dictionaryMeta: '++id, &key',
})

// Version 5: Add processedBooks table for pre-processed EPUB data
// The old 'files' table is kept for backwards compatibility but not used
db.version(5).stores({
  metadata: '++id, title, author, addedAt, lastReadAt',
  files: '++id, metadataId',
  processedBooks: '++id, metadataId',
  progress: '++id, &metadataId',
  dictionary: '++id, word, reading, reading2, reading3, frequency',
  dictionaryMeta: '++id, &key',
})

export { db }
export type {
  EpubMetadata,
  EpubFile,
  ProcessedBook,
  ReadingProgress,
  DictionaryEntry,
  DictionaryMeta,
}
