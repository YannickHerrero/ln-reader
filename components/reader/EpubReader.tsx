'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEpubReader } from '@/hooks/use-epub-reader'
import { useReaderSettings } from '@/hooks/use-reader-settings'
import { usePagination } from '@/hooks/use-pagination'
import { useTouchNavigation } from '@/hooks/use-touch-navigation'
import { ReaderContent } from './ReaderContent'
import { ReaderNavigation } from './ReaderNavigation'
import { ReaderBottomSheet } from './ReaderBottomSheet'
import { ReaderProgress } from './ReaderProgress'
import { WordLookupSheet } from './WordLookupSheet'
import type { WordSelection } from '@/hooks/use-word-selection'

interface EpubReaderProps {
  bookId: number
}

export function EpubReader({ bookId }: EpubReaderProps) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [isWordLookupOpen, setIsWordLookupOpen] = useState(false)
  const [selectedWord, setSelectedWord] = useState<WordSelection | null>(null)

  const { settings, setSettings, isHydrated } = useReaderSettings()

  const {
    chapters,
    currentChapterIndex,
    processedContent,
    isLoading,
    error,
    nextChapter,
    prevChapter,
    savedProgress,
    saveProgress,
  } = useEpubReader(bookId)

  const {
    currentPage,
    totalPages,
    nextPage,
    prevPage,
    goToPage,
    recalculate,
  } = usePagination(containerRef, {
    direction: settings.direction,
    onPageChange: (page) => {
      // Save progress when page changes
      saveProgress(currentChapterIndex, page)
    },
  })

  // Restore saved page position when chapter loads (only once per chapter)
  const restoredChapterRef = useRef<number | null>(null)
  useEffect(() => {
    if (
      savedProgress &&
      savedProgress.chapterIndex === currentChapterIndex &&
      restoredChapterRef.current !== currentChapterIndex
    ) {
      restoredChapterRef.current = currentChapterIndex
      // Wait for content to render, then go to saved page
      const timer = setTimeout(() => {
        goToPage(savedProgress.pageIndex)
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [savedProgress, currentChapterIndex, goToPage])

  const handleNext = useCallback(() => {
    // Try next page first, if at end of chapter, go to next chapter
    const hasMorePages = nextPage()
    if (!hasMorePages && currentChapterIndex < chapters.length - 1) {
      nextChapter()
      // Reset to page 0 for new chapter
      setTimeout(() => goToPage(0), 100)
    }
  }, [nextPage, currentChapterIndex, chapters.length, nextChapter, goToPage])

  const handlePrev = useCallback(() => {
    // Try prev page first, if at start of chapter, go to prev chapter
    const hasMorePages = prevPage()
    if (!hasMorePages && currentChapterIndex > 0) {
      prevChapter()
      // Go to last page of previous chapter after it loads
      setTimeout(() => {
        recalculate()
        goToPage(totalPages - 1)
      }, 200)
    }
  }, [prevPage, currentChapterIndex, prevChapter, recalculate, goToPage, totalPages])

  const handleOpenSettings = useCallback(() => {
    setIsSheetOpen(true)
  }, [])

  const handleWordSelect = useCallback((selection: WordSelection) => {
    setSelectedWord(selection)
    setIsWordLookupOpen(true)
  }, [])

  const { handleClick } = useTouchNavigation(containerRef, {
    onCenter: handleOpenSettings,
    onWordSelect: handleWordSelect,
  })

  const handleContentReady = useCallback(() => {
    recalculate()
  }, [recalculate])

  // Recalculate pagination when settings or content change
  useEffect(() => {
    // Delay to allow CSS columns to render
    const timer = setTimeout(() => {
      recalculate()
    }, 150)
    return () => clearTimeout(timer)
  }, [settings.fontSize, settings.lineHeight, settings.direction, processedContent, recalculate])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if a sheet is open
      if (isSheetOpen || isWordLookupOpen) return

      switch (e.key) {
        case 'ArrowLeft':
          // In vertical-rl mode, left = next (pages flow right-to-left)
          if (settings.direction === 'vertical-rl') {
            handleNext()
          } else {
            handlePrev()
          }
          break
        case 'ArrowRight':
          // In vertical-rl mode, right = prev
          if (settings.direction === 'vertical-rl') {
            handlePrev()
          } else {
            handleNext()
          }
          break
        case ' ':
          e.preventDefault()
          setIsSheetOpen(true)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handlePrev, handleNext, settings.direction, isSheetOpen, isWordLookupOpen])

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
      <div className="bg-background flex h-screen flex-col items-center justify-center gap-2">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        <p className="text-muted-foreground">Loading book...</p>
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
        <ReaderNavigation onClick={handleClick}>
          <ReaderContent
            ref={containerRef}
            content={processedContent}
            settings={settings}
            onContentReady={handleContentReady}
          />
        </ReaderNavigation>
      </main>

      {/* Progress bar and navigation buttons */}
      <ReaderProgress
        currentPage={currentPage}
        totalPages={totalPages}
        currentChapter={currentChapterIndex}
        totalChapters={chapters.length}
        onPrev={handlePrev}
        onNext={handleNext}
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
