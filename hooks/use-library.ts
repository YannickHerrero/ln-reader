'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db, type EpubMetadata } from '@/lib/db'

export type BookWithProgress = EpubMetadata & {
  readingProgress?: number // 0-1 ratio
}

export function useLibrary() {
  const books = useLiveQuery(async () => {
    const metadata = await db.metadata.orderBy('addedAt').reverse().toArray()
    const allProgress = await db.progress.toArray()

    // Create a map of metadataId -> progress
    const progressMap = new Map<number, number>()
    for (const p of allProgress) {
      progressMap.set(p.metadataId, p.progress)
    }

    // Combine metadata with progress
    return metadata.map((book): BookWithProgress => ({
      ...book,
      readingProgress: book.id ? progressMap.get(book.id) : undefined,
    }))
  })

  const addBook = async (
    file: File,
    metadata: Omit<EpubMetadata, 'id' | 'addedAt' | 'lastReadAt'>
  ) => {
    const metadataId = await db.metadata.add({
      ...metadata,
      addedAt: new Date(),
      lastReadAt: null,
    })

    await db.files.add({
      metadataId: metadataId as number,
      blob: file,
    })

    return metadataId
  }

  const deleteBook = async (id: number) => {
    await db.files.where('metadataId').equals(id).delete()
    await db.metadata.delete(id)
  }

  const getBookFile = async (metadataId: number) => {
    return db.files.where('metadataId').equals(metadataId).first()
  }

  return {
    books,
    addBook,
    deleteBook,
    getBookFile,
    isLoading: books === undefined,
  }
}
