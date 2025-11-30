'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEpubReader } from '@/hooks/use-epub-reader'
import { useReaderSettings } from '@/hooks/use-reader-settings'
import { BookReader } from './BookReader'
import { ReaderBottomSheet } from './ReaderBottomSheet'
import { ReaderProgress } from './ReaderProgress'
import { WordLookupSheet } from './WordLookupSheet'
import { debounce } from '@/lib/utils'
import type { WordSelection } from '@/hooks/use-word-selection'

interface EpubReaderProps {
  bookId: number
}

export function EpubReader({ bookId }: EpubReaderProps) {
  const router = useRouter()
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [isWordLookupOpen, setIsWordLookupOpen] = useState(false)
  const [selectedWord, setSelectedWord] = useState<WordSelection | null>(null)

  // Scroll percentage state (0-1)
  const [scrollPercent, setScrollPercent] = useState(0)

  const { settings, setSettings, isHydrated } = useReaderSettings()

  const {
    chapters,
    currentChapterIndex,
    processedContent,
    styleSheet,
    isLoading,
    error,
    nextChapter,
    prevChapter,
    savedScrollPercent,
    accumulatedChapterChars,
    totalBookCharCount,
    saveProgress,
  } = useEpubReader(bookId)

  // Track restored state per chapter
  const restoredChapterRef = useRef<number | null>(null)
  const [savedScrollPercentForChapter, setSavedScrollPercentForChapter] = useState(0)

  // Debounced save progress to avoid excessive IndexedDB writes
  const debouncedSaveProgress = useMemo(
    () => debounce(saveProgress, 1000),
    [saveProgress]
  )

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => debouncedSaveProgress.cancel()
  }, [debouncedSaveProgress])

  // Handle scroll percentage changes from BookReader
  const handleScrollPercentChange = useCallback(
    (percent: number) => {
      setScrollPercent(percent)
      debouncedSaveProgress(currentChapterIndex, percent)
    },
    [currentChapterIndex, debouncedSaveProgress]
  )

  // Calculate saved scroll percent for current chapter
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (restoredChapterRef.current !== currentChapterIndex) {
      restoredChapterRef.current = currentChapterIndex
      setSavedScrollPercentForChapter(savedScrollPercent)
      setScrollPercent(savedScrollPercent)
    }
  }, [savedScrollPercent, currentChapterIndex])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Calculate whole-book progress using character-weighted approach
  const totalProgress = useMemo(() => {
    if (totalBookCharCount <= 0) return 0

    const charsBeforeChapter = accumulatedChapterChars[currentChapterIndex] || 0
    const currentChapterChars = chapters[currentChapterIndex]?.charCount || 0
    const charsInCurrentChapter = scrollPercent * currentChapterChars

    return ((charsBeforeChapter + charsInCurrentChapter) / totalBookCharCount) * 100
  }, [
    totalBookCharCount,
    accumulatedChapterChars,
    currentChapterIndex,
    chapters,
    scrollPercent,
  ])

  const handleOpenSettings = useCallback(() => {
    setIsSheetOpen(true)
  }, [])

  const handleWordSelect = useCallback((selection: WordSelection) => {
    setSelectedWord(selection)
    setIsWordLookupOpen(true)
  }, [])

  // Handle chapter navigation
  const handleNextChapter = useCallback(() => {
    if (currentChapterIndex < chapters.length - 1) {
      restoredChapterRef.current = null // Allow restore for new chapter
      nextChapter()
    }
  }, [currentChapterIndex, chapters.length, nextChapter])

  const handlePrevChapter = useCallback(() => {
    if (currentChapterIndex > 0) {
      restoredChapterRef.current = null // Allow restore for new chapter
      prevChapter()
    }
  }, [currentChapterIndex, prevChapter])

  // Keyboard shortcuts for settings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSheetOpen || isWordLookupOpen) return

      if (e.key === ' ') {
        e.preventDefault()
        setIsSheetOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSheetOpen, isWordLookupOpen])

  if (!isHydrated) {
    return (
      <div className="bg-background flex h-screen items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-background flex h-screen flex-col items-center justify-center gap-4">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" onClick={() => router.push('/')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Library
        </Button>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="bg-background flex h-screen items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="bg-background fixed inset-0 flex flex-col">
      {/* Header */}
      <header className="bg-background/80 absolute top-0 right-0 left-0 z-10 flex items-center gap-2 p-2 backdrop-blur-sm">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/')}
          aria-label="Back to library"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </header>

      {/* Reader area */}
      <main className="flex-1 overflow-hidden pt-12 pb-16">
        <BookReader
          content={processedContent}
          styleSheet={styleSheet}
          settings={settings}
          savedScrollPercent={savedScrollPercentForChapter}
          onScrollPercentChange={handleScrollPercentChange}
          onPrevChapter={handlePrevChapter}
          onNextChapter={handleNextChapter}
          onWordSelect={handleWordSelect}
        />
      </main>

      {/* Progress bar */}
      <ReaderProgress
        progress={totalProgress}
        onPrevChapter={handlePrevChapter}
        onNextChapter={handleNextChapter}
        onOpenSettings={handleOpenSettings}
        canGoPrev={currentChapterIndex > 0}
        canGoNext={currentChapterIndex < chapters.length - 1}
      />

      {/* Settings bottom sheet */}
      <ReaderBottomSheet
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        settings={settings}
        onSettingsChange={setSettings}
      />

      {/* Word lookup bottom sheet */}
      <WordLookupSheet
        open={isWordLookupOpen}
        onOpenChange={setIsWordLookupOpen}
        selection={selectedWord}
      />
    </div>
  )
}
