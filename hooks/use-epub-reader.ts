'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { loadEpubBook, type Epub, type EpubChapter } from 'epubix'
import { db, type ReadingProgress } from '@/lib/db'
import { processChapterContent, revokeBlobUrls } from '@/lib/epub-renderer'

interface UseEpubReaderResult {
  epub: Epub | null
  chapters: EpubChapter[]
  currentChapter: EpubChapter | null
  currentChapterIndex: number
  processedContent: string | null
  isLoading: boolean
  error: string | null
  goToChapter: (index: number) => void
  nextChapter: () => void
  prevChapter: () => void
  savedProgress: ReadingProgress | null
  /** Accumulated character counts per chapter (chars before each chapter) */
  accumulatedChapterChars: number[]
  /** Total character count for the entire book */
  totalBookCharCount: number
  /** Save progress using character count (new system) */
  saveProgress: (
    chapterIndex: number,
    exploredCharCount: number,
    chapterCharCount: number
  ) => Promise<void>
}

export function useEpubReader(bookId: number): UseEpubReaderResult {
  const [epub, setEpub] = useState<Epub | null>(null)
  const [chapters, setChapters] = useState<EpubChapter[]>([])
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0)
  const [processedContent, setProcessedContent] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savedProgress, setSavedProgress] = useState<ReadingProgress | null>(null)
  const [accumulatedChapterChars, setAccumulatedChapterChars] = useState<number[]>([])
  const [totalBookCharCount, setTotalBookCharCount] = useState(0)

  const blobUrlsRef = useRef<string[]>([])

  // Load EPUB and progress
  useEffect(() => {
    let mounted = true

    async function loadBook() {
      setIsLoading(true)
      setError(null)

      try {
        // Get the file and metadata from IndexedDB
        const [file, metadata] = await Promise.all([
          db.files.where('metadataId').equals(bookId).first(),
          db.metadata.get(bookId),
        ])
        if (!file) {
          throw new Error('Book file not found')
        }

        // Load the EPUB
        const loadedEpub = await loadEpubBook(file.blob)
        if (!mounted) return

        setEpub(loadedEpub)
        const loadedChapters = loadedEpub.chapters || []
        setChapters(loadedChapters)

        // Build accumulated array from cached character counts
        const chapterCharCounts = metadata?.chapterCharCounts || []
        const accChars: number[] = []
        let accumulated = 0
        for (const count of chapterCharCounts) {
          accChars.push(accumulated)
          accumulated += count
        }

        if (mounted) {
          setAccumulatedChapterChars(accChars)
          setTotalBookCharCount(metadata?.totalCharCount || 0)
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

  // Process chapter content when chapter changes
  useEffect(() => {
    let mounted = true

    async function processContent() {
      if (!epub || chapters.length === 0) return

      const chapter = chapters[currentChapterIndex]
      if (!chapter) return

      // Clean up previous blob URLs
      revokeBlobUrls(blobUrlsRef.current)
      blobUrlsRef.current = []

      try {
        const { html, blobUrls } = await processChapterContent(
          chapter.content,
          epub,
          chapter.href
        )

        if (mounted) {
          blobUrlsRef.current = blobUrls
          setProcessedContent(html)
        } else {
          // Clean up if unmounted
          revokeBlobUrls(blobUrls)
        }
      } catch (err) {
        console.error('Failed to process chapter:', err)
        if (mounted) {
          setProcessedContent(chapter.content)
        }
      }
    }

    processContent()

    return () => {
      mounted = false
    }
  }, [epub, chapters, currentChapterIndex])

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      revokeBlobUrls(blobUrlsRef.current)
    }
  }, [])

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

  const currentChapter = chapters[currentChapterIndex] || null

  return {
    epub,
    chapters,
    currentChapter,
    currentChapterIndex,
    processedContent,
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
