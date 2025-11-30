'use client'

import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type EpubMetadata } from '@/lib/db'
import { processEpub } from '@/lib/epub-processor'
import { useLibrarySettings, type LibrarySortOrder } from './use-library-settings'

export type BookWithProgress = EpubMetadata & {
  readingProgress?: number // 0-1 ratio
}

function sortBooks(books: BookWithProgress[], sortOrder: LibrarySortOrder): BookWithProgress[] {
  return [...books].sort((a, b) => {
    switch (sortOrder) {
      case 'last-opened':
        if (a.lastReadAt && b.lastReadAt) {
          return b.lastReadAt.getTime() - a.lastReadAt.getTime()
        }
        if (a.lastReadAt && !b.lastReadAt) return -1
        if (!a.lastReadAt && b.lastReadAt) return 1
        return b.addedAt.getTime() - a.addedAt.getTime()

      case 'last-added':
        return b.addedAt.getTime() - a.addedAt.getTime()

      case 'progress':
        return (b.readingProgress ?? 0) - (a.readingProgress ?? 0)

      case 'title':
        return a.title.localeCompare(b.title, 'ja')

      case 'author':
        return a.author.localeCompare(b.author, 'ja')

      default:
        return 0
    }
  })
}

export function useLibrary() {
  const { settings } = useLibrarySettings()

  const rawBooks = useLiveQuery(async () => {
    const metadata = await db.metadata.toArray()
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

  const books = useMemo(() => {
    if (!rawBooks) return undefined
    return sortBooks(rawBooks, settings.sortOrder)
  }, [rawBooks, settings.sortOrder])

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
