import Dexie, { type EntityTable } from 'dexie'
import type { EpubMetadata, EpubFile } from './types'

const db = new Dexie('LNReaderDB') as Dexie & {
  metadata: EntityTable<EpubMetadata, 'id'>
  files: EntityTable<EpubFile, 'id'>
}

db.version(1).stores({
  metadata: '++id, title, author, addedAt, lastReadAt',
  files: '++id, metadataId',
})

export { db }
export type { EpubMetadata, EpubFile }
