'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { db, type ReadingProgress, type ProcessedBook } from '@/lib/db'
import { createBlobUrls, replaceDummyUrls, revokeBlobUrls } from '@/lib/epub-processor'

interface UseEpubReaderResult {
  /** Pre-processed chapters from IndexedDB */
  chapters: { id: string; title?: string; charCount: number }[]
  /** Current chapter index */
  currentChapterIndex: number
  /** Processed HTML content for current chapter (with real image URLs) */
  processedContent: string | null
  /** Scoped CSS stylesheet from EPUB */
  styleSheet: string
  /** Loading state */
  isLoading: boolean
  /** Error message if any */
  error: string | null
  /** Navigate to specific chapter */
  goToChapter: (index: number) => void
  /** Navigate to next chapter */
  nextChapter: () => void
  /** Navigate to previous chapter */
  prevChapter: () => void
  /** Saved reading progress */
  savedProgress: ReadingProgress | null
  /** Accumulated character counts per chapter (chars before each chapter) */
  accumulatedChapterChars: number[]
  /** Total character count for the entire book */
  totalBookCharCount: number
  /** Save progress using character count */
  saveProgress: (
    chapterIndex: number,
    exploredCharCount: number,
    chapterCharCount: number
  ) => Promise<void>
}

export function useEpubReader(bookId: number): UseEpubReaderResult {
  const [processedBook, setProcessedBook] = useState<ProcessedBook | null>(null)
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savedProgress, setSavedProgress] = useState<ReadingProgress | null>(null)
  const [accumulatedChapterChars, setAccumulatedChapterChars] = useState<number[]>([])
  const [totalBookCharCount, setTotalBookCharCount] = useState(0)

  // Store blob URLs for cleanup
  const blobUrlsRef = useRef<Map<string, string>>(new Map())

  // Load processed book and progress
  useEffect(() => {
    let mounted = true

    async function loadBook() {
      setIsLoading(true)
      setError(null)

      try {
        // Get the processed book data from IndexedDB
        const [book, metadata] = await Promise.all([
          db.processedBooks.where('metadataId').equals(bookId).first(),
          db.metadata.get(bookId),
        ])

        if (!book) {
          throw new Error('Book not found. Please re-import the book.')
        }

        if (!mounted) return

        // Create blob URLs for images
        const urls = createBlobUrls(book.blobs)
        blobUrlsRef.current = urls

        setProcessedBook(book)

        // Build accumulated array from chapter character counts
        const accChars: number[] = []
        let accumulated = 0
        for (const chapter of book.chapters) {
          accChars.push(accumulated)
          accumulated += chapter.charCount
        }

        if (mounted) {
          setAccumulatedChapterChars(accChars)
          setTotalBookCharCount(metadata?.totalCharCount || accumulated)
        }

        // Load saved progress
        const progress = await db.progress
          .where('metadataId')
          .equals(bookId)
          .first()

        if (progress && mounted) {
          setSavedProgress(progress)
          setCurrentChapterIndex(progress.chapterIndex)
        }

        // Update lastReadAt
        await db.metadata.update(bookId, { lastReadAt: new Date() })
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load book')
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    loadBook()

    return () => {
      mounted = false
    }
  }, [bookId])

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      revokeBlobUrls(blobUrlsRef.current)
    }
  }, [])

  // Get processed content for current chapter with real image URLs
  const processedContent = useMemo(() => {
    if (!processedBook) return null
    const chapter = processedBook.chapters[currentChapterIndex]
    if (!chapter) return null

    // Replace dummy URLs with actual blob URLs
    return replaceDummyUrls(chapter.html, blobUrlsRef.current)
  }, [processedBook, currentChapterIndex])

  // Get chapters metadata for navigation
  const chapters = useMemo(() => {
    if (!processedBook) return []
    return processedBook.chapters.map((ch) => ({
      id: ch.id,
      title: ch.title,
      charCount: ch.charCount,
    }))
  }, [processedBook])

  const goToChapter = useCallback(
    (index: number) => {
      if (index >= 0 && index < chapters.length) {
        setCurrentChapterIndex(index)
      }
    },
    [chapters.length]
  )

  const nextChapter = useCallback(() => {
    if (currentChapterIndex < chapters.length - 1) {
      setCurrentChapterIndex((prev) => prev + 1)
    }
  }, [currentChapterIndex, chapters.length])

  const prevChapter = useCallback(() => {
    if (currentChapterIndex > 0) {
      setCurrentChapterIndex((prev) => prev - 1)
    }
  }, [currentChapterIndex])

  const saveProgress = useCallback(
    async (
      chapterIndex: number,
      exploredCharCount: number,
      chapterCharCount: number
    ) => {
      // Calculate whole-book progress using actual character counts
      const charsBeforeCurrentChapter = accumulatedChapterChars[chapterIndex] || 0
      const totalExploredChars = charsBeforeCurrentChapter + exploredCharCount
      const progress = totalBookCharCount > 0 ? totalExploredChars / totalBookCharCount : 0

      const progressData: Omit<ReadingProgress, 'id'> = {
        metadataId: bookId,
        chapterIndex,
        exploredCharCount,
        bookCharCount: chapterCharCount,
        progress,
        lastRead: new Date(),
      }

      // Upsert progress
      const existing = await db.progress
        .where('metadataId')
        .equals(bookId)
        .first()

      if (existing?.id) {
        await db.progress.update(existing.id, progressData)
      } else {
        await db.progress.add(progressData as ReadingProgress)
      }

      setSavedProgress({ ...progressData, id: existing?.id })
    },
    [bookId, accumulatedChapterChars, totalBookCharCount]
  )

  return {
    chapters,
    currentChapterIndex,
    processedContent,
    styleSheet: processedBook?.styleSheet || '',
    isLoading,
    error,
    goToChapter,
    nextChapter,
    prevChapter,
    savedProgress,
    accumulatedChapterChars,
    totalBookCharCount,
    saveProgress,
  }
}
