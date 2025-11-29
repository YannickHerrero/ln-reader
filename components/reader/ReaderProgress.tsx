'use client'

import { ChevronLeft, ChevronRight, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ReaderProgressProps {
  /** Number of characters read in current chapter */
  exploredCharCount: number
  /** Total characters in current chapter */
  bookCharCount: number
  /** Current chapter index (0-based) */
  currentChapter: number
  /** Total number of chapters */
  totalChapters: number
  /** Navigate to previous chapter */
  onPrevChapter: () => void
  /** Navigate to next chapter */
  onNextChapter: () => void
  /** Open settings sheet */
  onOpenSettings: () => void
}

/**
 * Format a number with thousand separators
 */
function formatNumber(n: number): string {
  return n.toLocaleString()
}

export function ReaderProgress({
  exploredCharCount,
  bookCharCount,
  currentChapter,
  totalChapters,
  onPrevChapter,
  onNextChapter,
  onOpenSettings,
}: ReaderProgressProps) {
  const progress = bookCharCount > 0 ? (exploredCharCount / bookCharCount) * 100 : 0

  return (
    <div className="bg-background/80 absolute bottom-0 left-0 right-0 backdrop-blur-sm">
      {/* Progress bar */}
      <div className="bg-muted h-1 w-full">
        <div
          className="bg-primary h-full transition-all duration-200"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>

      {/* Navigation and progress info */}
      <div className="flex items-center justify-between px-2 py-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onPrevChapter}
          disabled={currentChapter <= 0}
          aria-label="Previous chapter"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>

        <div className="flex items-center gap-2">
          <div className="text-muted-foreground flex flex-col items-center text-xs">
            <span>
              {formatNumber(exploredCharCount)} / {formatNumber(bookCharCount)} chars
            </span>
            <span>
              Chapter {currentChapter + 1}/{totalChapters}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenSettings}
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onNextChapter}
          disabled={currentChapter >= totalChapters - 1}
          aria-label="Next chapter"
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      </div>
    </div>
  )
}
