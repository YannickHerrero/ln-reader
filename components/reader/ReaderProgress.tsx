'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ReaderProgressProps {
  currentPage: number
  totalPages: number
  currentChapter: number
  totalChapters: number
  onPrev: () => void
  onNext: () => void
}

export function ReaderProgress({
  currentPage,
  totalPages,
  currentChapter,
  totalChapters,
  onPrev,
  onNext,
}: ReaderProgressProps) {
  const progress = totalPages > 0 ? ((currentPage + 1) / totalPages) * 100 : 0

  return (
    <div className="bg-background/80 absolute bottom-0 left-0 right-0 backdrop-blur-sm">
      {/* Progress bar */}
      <div className="bg-muted h-1 w-full">
        <div
          className="bg-primary h-full transition-all duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Navigation and page info */}
      <div className="flex items-center justify-between px-2 py-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onPrev}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>

        <div className="text-muted-foreground flex flex-col items-center text-xs">
          <span>
            Page {currentPage + 1}/{totalPages}
          </span>
          <span>
            Chapter {currentChapter + 1}/{totalChapters}
          </span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onNext}
          aria-label="Next page"
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      </div>
    </div>
  )
}
