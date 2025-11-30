'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db, type EpubMetadata } from '@/lib/db'
import { processEpub } from '@/lib/epub-processor'

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

  /**
   * Import and process an EPUB file
   * Heavy processing happens here at import time for fast reading later
   */
  const addBook = async (file: File) => {
    // Process the EPUB (extract HTML, CSS, images, count characters)
    const processed = await processEpub(file)

    // Store metadata
    const metadataId = await db.metadata.add({
      title: processed.metadata.title,
      author: processed.metadata.author,
      language: processed.metadata.language,
      coverUrl: processed.metadata.coverUrl,
      chapterCharCounts: processed.chapterCharCounts,
      totalCharCount: processed.totalCharCount,
      addedAt: new Date(),
      lastReadAt: null,
    })

    // Store processed book data
    await db.processedBooks.add({
      metadataId: metadataId as number,
      chapters: processed.chapters,
      styleSheet: processed.styleSheet,
      blobs: processed.blobs,
    })

    return metadataId
  }

  const deleteBook = async (id: number) => {
    await db.processedBooks.where('metadataId').equals(id).delete()
    await db.progress.where('metadataId').equals(id).delete()
    await db.metadata.delete(id)
  }

  return {
    books,
    addBook,
    deleteBook,
    isLoading: books === undefined,
  }
}
