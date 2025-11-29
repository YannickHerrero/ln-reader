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

interface EpubReaderProps {
  bookId: number
}

export function EpubReader({ bookId }: EpubReaderProps) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)

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

  // Restore saved page position when chapter loads
  useEffect(() => {
    if (savedProgress && savedProgress.chapterIndex === currentChapterIndex) {
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

  const handleCenter = useCallback(() => {
    setIsSheetOpen(true)
  }, [])

  const { handleTouchStart, handleTouchEnd, handleClick } = useTouchNavigation(
    containerRef,
    {
      direction: settings.direction,
      onNext: handleNext,
      onPrev: handlePrev,
      onCenter: handleCenter,
    }
  )

  const handleContentReady = useCallback(() => {
    recalculate()
  }, [recalculate])

  // Recalculate pagination when settings change
  useEffect(() => {
    recalculate()
  }, [settings.fontSize, settings.lineHeight, settings.direction, recalculate])

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
      {/* Header - shown when sheet is open or on hover */}
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
      <main className="flex-1 overflow-hidden pt-12 pb-12">
        <ReaderNavigation
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={handleClick}
        >
          <ReaderContent
            ref={containerRef}
            content={processedContent}
            settings={settings}
            onContentReady={handleContentReady}
          />
        </ReaderNavigation>
      </main>

      {/* Progress bar */}
      <ReaderProgress
        currentPage={currentPage}
        totalPages={totalPages}
        currentChapter={currentChapterIndex}
        totalChapters={chapters.length}
      />

      {/* Settings bottom sheet */}
      <ReaderBottomSheet
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        settings={settings}
        onSettingsChange={setSettings}
      />
    </div>
  )
}
