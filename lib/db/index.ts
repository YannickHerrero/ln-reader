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

export { db }
export type { EpubMetadata, EpubFile, ReadingProgress }
