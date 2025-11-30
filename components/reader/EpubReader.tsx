'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEpubReader } from '@/hooks/use-epub-reader'
import { useReaderSettings } from '@/hooks/use-reader-settings'
import { BookReader } from './BookReader'
import { ReaderBottomSheet } from './ReaderBottomSheet'
import { ReaderProgress } from './ReaderProgress'
import { WordLookupSheet } from './WordLookupSheet'
import type { WordSelection } from '@/hooks/use-word-selection'

interface EpubReaderProps {
  bookId: number
}

export function EpubReader({ bookId }: EpubReaderProps) {
  const router = useRouter()
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [isWordLookupOpen, setIsWordLookupOpen] = useState(false)
  const [selectedWord, setSelectedWord] = useState<WordSelection | null>(null)

  // Character count state (explored chars in current chapter)
  const [exploredCharCount, setExploredCharCount] = useState(0)

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
    accumulatedChapterChars,
    totalBookCharCount,
    saveProgress,
  } = useEpubReader(bookId)

  // Track restored state per chapter
  const restoredChapterRef = useRef<number | null>(null)
  const [savedCharCountForChapter, setSavedCharCountForChapter] = useState(0)

  // Handle character count changes from BookReader
  const handleCharCountChange = useCallback(
    (explored: number, total: number) => {
      setExploredCharCount(explored)
      saveProgress(currentChapterIndex, explored, total)
    },
    [currentChapterIndex, saveProgress]
  )

  // Calculate saved char count for current chapter (effect-based to avoid ref access during render)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (
      savedProgress &&
      savedProgress.chapterIndex === currentChapterIndex &&
      restoredChapterRef.current !== currentChapterIndex
    ) {
      restoredChapterRef.current = currentChapterIndex
      setSavedCharCountForChapter(savedProgress.exploredCharCount || 0)
    } else if (restoredChapterRef.current !== currentChapterIndex) {
      // Reset for new chapter
      setSavedCharCountForChapter(0)
    }
  }, [savedProgress, currentChapterIndex])
  /* eslint-enable react-hooks/set-state-in-effect */

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
        <BookReader
          content={processedContent}
          settings={settings}
          savedCharCount={savedCharCountForChapter}
          onCharCountChange={handleCharCountChange}
          onPrevChapter={handlePrevChapter}
          onNextChapter={handleNextChapter}
          onWordSelect={handleWordSelect}
        />
      </main>

      {/* Progress bar */}
      <ReaderProgress
        progress={
          totalBookCharCount > 0
            ? (((accumulatedChapterChars[currentChapterIndex] || 0) + exploredCharCount) / totalBookCharCount) * 100
            : 0
        }
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
