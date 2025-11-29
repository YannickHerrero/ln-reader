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
import { VerticalReader, useVerticalReaderNavigation } from './VerticalReader'
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

  // Vertical reader page state (for carousel mode)
  const [verticalPage, setVerticalPage] = useState(0)
  const [verticalTotalPages, setVerticalTotalPages] = useState(0)
  const verticalNav = useVerticalReaderNavigation()

  const { settings, setSettings, isHydrated } = useReaderSettings()
  const isVerticalMode = settings.direction === 'vertical-rl'

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

  // LTR pagination (CSS columns mode)
  const {
    currentPage: ltrPage,
    totalPages: ltrTotalPages,
    nextPage: ltrNextPage,
    prevPage: ltrPrevPage,
    goToPage: ltrGoToPage,
    recalculate,
  } = usePagination(containerRef, {
    direction: settings.direction,
    onPageChange: (page) => {
      if (!isVerticalMode) {
        saveProgress(currentChapterIndex, page)
      }
    },
  })

  // Use appropriate page values based on mode
  const currentPage = isVerticalMode ? verticalPage : ltrPage
  const totalPages = isVerticalMode ? verticalTotalPages : ltrTotalPages

  // Handle vertical reader page changes
  const handleVerticalPageChange = useCallback(
    (page: number, total: number) => {
      setVerticalPage(page)
      setVerticalTotalPages(total)
      saveProgress(currentChapterIndex, page)
    },
    [currentChapterIndex, saveProgress]
  )

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
        if (isVerticalMode) {
          verticalNav.goToPage(savedProgress.pageIndex)
        } else {
          ltrGoToPage(savedProgress.pageIndex)
        }
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [savedProgress, currentChapterIndex, isVerticalMode, ltrGoToPage, verticalNav])

  const handleNext = useCallback(() => {
    if (isVerticalMode) {
      const canScroll = verticalPage < verticalTotalPages - 1
      if (canScroll) {
        verticalNav.nextPage()
      } else if (currentChapterIndex < chapters.length - 1) {
        nextChapter()
        setTimeout(() => verticalNav.goToPage(0), 100)
      }
    } else {
      const hasMorePages = ltrNextPage()
      if (!hasMorePages && currentChapterIndex < chapters.length - 1) {
        nextChapter()
        setTimeout(() => ltrGoToPage(0), 100)
      }
    }
  }, [isVerticalMode, verticalPage, verticalTotalPages, verticalNav, ltrNextPage, currentChapterIndex, chapters.length, nextChapter, ltrGoToPage])

  const handlePrev = useCallback(() => {
    if (isVerticalMode) {
      const canScroll = verticalPage > 0
      if (canScroll) {
        verticalNav.prevPage()
      } else if (currentChapterIndex > 0) {
        prevChapter()
        // Go to last page after chapter loads
        setTimeout(() => {
          const total = verticalNav.getTotalPages()
          verticalNav.goToPage(total - 1)
        }, 300)
      }
    } else {
      const hasMorePages = ltrPrevPage()
      if (!hasMorePages && currentChapterIndex > 0) {
        prevChapter()
        setTimeout(() => {
          recalculate()
          ltrGoToPage(ltrTotalPages - 1)
        }, 200)
      }
    }
  }, [isVerticalMode, verticalPage, verticalNav, ltrPrevPage, currentChapterIndex, prevChapter, recalculate, ltrGoToPage, ltrTotalPages])

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
        {isVerticalMode ? (
          <VerticalReader
            content={processedContent}
            settings={settings}
            onPageChange={handleVerticalPageChange}
            onOpenSettings={handleOpenSettings}
            onWordSelect={handleWordSelect}
          />
        ) : (
          <ReaderNavigation onClick={handleClick}>
            <ReaderContent
              ref={containerRef}
              content={processedContent}
              settings={settings}
              onContentReady={handleContentReady}
            />
          </ReaderNavigation>
        )}
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
