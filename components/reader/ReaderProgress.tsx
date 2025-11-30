'use client'

import { ChevronLeft, ChevronRight, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ReaderProgressProps {
  /** Progress percentage (0-100) */
  progress: number
  /** Navigate to previous chapter */
  onPrevChapter: () => void
  /** Navigate to next chapter */
  onNextChapter: () => void
  /** Open settings sheet */
  onOpenSettings: () => void
  /** Whether previous chapter button should be disabled */
  canGoPrev: boolean
  /** Whether next chapter button should be disabled */
  canGoNext: boolean
}

export function ReaderProgress({
  progress,
  onPrevChapter,
  onNextChapter,
  onOpenSettings,
  canGoPrev,
  canGoNext,
}: ReaderProgressProps) {
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
          disabled={!canGoPrev}
          aria-label="Previous chapter"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">
            {Math.round(progress)}%
          </span>
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
          disabled={!canGoNext}
          aria-label="Next chapter"
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      </div>
    </div>
  )
}
