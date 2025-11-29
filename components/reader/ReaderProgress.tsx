'use client'

interface ReaderProgressProps {
  currentPage: number
  totalPages: number
  currentChapter: number
  totalChapters: number
}

export function ReaderProgress({
  currentPage,
  totalPages,
  currentChapter,
  totalChapters,
}: ReaderProgressProps) {
  const progress = totalPages > 0 ? ((currentPage + 1) / totalPages) * 100 : 0

  return (
    <div className="bg-background/80 pointer-events-none absolute bottom-0 left-0 right-0 backdrop-blur-sm">
      {/* Progress bar */}
      <div className="bg-muted h-1 w-full">
        <div
          className="bg-primary h-full transition-all duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Page info */}
      <div className="text-muted-foreground flex items-center justify-between px-4 py-2 text-xs">
        <span>
          Chapter {currentChapter + 1}/{totalChapters}
        </span>
        <span>
          Page {currentPage + 1}/{totalPages}
        </span>
      </div>
    </div>
  )
}
