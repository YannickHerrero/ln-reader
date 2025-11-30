'use client'

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type CSSProperties,
} from 'react'
import { Loader2 } from 'lucide-react'
import { usePageManager } from '@/lib/pagination/page-manager'
import { CharacterStatsCalculator } from '@/lib/pagination/character-stats-calculator'
import type { ReaderSettings } from '@/hooks/use-reader-settings'
import {
  getClickedWordAndSentence,
  isClickOnText,
  type WordSelection,
} from '@/hooks/use-word-selection'

interface BookReaderProps {
  /** HTML content to display */
  content: string | null
  /** Reader settings (font size, line height, direction) */
  settings: ReaderSettings
  /** Saved character count position to restore */
  savedCharCount?: number
  /** Callback when character count changes */
  onCharCountChange?: (explored: number, total: number) => void
  /** Callback when navigating to previous chapter */
  onPrevChapter?: () => void
  /** Callback when navigating to next chapter */
  onNextChapter?: () => void
  /** Callback when user selects a word */
  onWordSelect?: (selection: WordSelection) => void
}

const PAGE_GAP = 40

export function BookReader({
  content,
  settings,
  savedCharCount = 0,
  onCharCountChange,
  onPrevChapter,
  onNextChapter,
  onWordSelect,
}: BookReaderProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [calculator, setCalculator] = useState<CharacterStatsCalculator | null>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const restoredRef = useRef(false)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  // Derive loading state from calculator presence
  const isLoading = !calculator && !!content

  const { fontSize, lineHeight, direction } = settings
  const verticalMode = direction === 'vertical-rl'

  // Page manager hook
  const pageManager = usePageManager({
    contentRef,
    scrollRef,
    width: containerSize.width,
    height: containerSize.height,
    verticalMode,
    pageGap: PAGE_GAP,
    onPrevSection: onPrevChapter,
    onNextSection: onNextChapter,
    onPageChange: useCallback(
      (pos: number) => {
        if (calculator && scrollRef.current) {
          // Use scroll percentage instead of paragraph position mapping
          // This works better with CSS columns where off-screen text nodes have 0 rect
          const scrollSize = verticalMode
            ? scrollRef.current.scrollHeight
            : scrollRef.current.scrollWidth
          const viewportSize = verticalMode
            ? scrollRef.current.clientHeight
            : scrollRef.current.clientWidth
          const maxScroll = Math.max(scrollSize - viewportSize, 1)
          const scrollPercent = Math.min(pos / maxScroll, 1)
          const explored = Math.round(scrollPercent * calculator.charCount)
          onCharCountChange?.(explored, calculator.charCount)
        }
      },
      [calculator, onCharCountChange, verticalMode]
    ),
  })

  // Measure container size
  useEffect(() => {
    if (!scrollRef.current) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })

    observer.observe(scrollRef.current)
    return () => observer.disconnect()
  }, [])

  // Initialize calculator when content or settings change
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    restoredRef.current = false

    if (!contentRef.current || !scrollRef.current || !content) {
      setCalculator(null)
      return
    }

    // Reset calculator for new content
    setCalculator(null)

    // Wait for DOM to render
    const timer = setTimeout(() => {
      if (!contentRef.current || !scrollRef.current) return

      const calc = new CharacterStatsCalculator(
        contentRef.current,
        verticalMode ? 'horizontal' : 'vertical',
        'ltr',
        scrollRef.current,
        document
      )
      calc.updateParagraphPos(0)
      setCalculator(calc)

      // Report initial char count
      onCharCountChange?.(0, calc.charCount)
    }, 150)

    return () => clearTimeout(timer)
  }, [content, verticalMode, fontSize, lineHeight, onCharCountChange])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Restore saved position
  useEffect(() => {
    if (
      calculator &&
      savedCharCount > 0 &&
      !restoredRef.current &&
      containerSize.width > 0
    ) {
      restoredRef.current = true
      const scrollPos = calculator.getScrollPosByCharCount(savedCharCount)
      if (scrollPos >= 0) {
        pageManager.scrollTo(scrollPos, false)
      }
    }
  }, [calculator, savedCharCount, pageManager, containerSize.width])

  // Recalculate positions on resize
  useEffect(() => {
    if (calculator && containerSize.width > 0 && containerSize.height > 0) {
      calculator.updateParagraphPos(pageManager.virtualScrollPos)
    }
  }, [calculator, containerSize.width, containerSize.height, pageManager.virtualScrollPos])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.altKey || e.ctrlKey || e.shiftKey || e.metaKey) return

      switch (e.code) {
        case 'ArrowLeft':
          pageManager[verticalMode ? 'nextPage' : 'prevPage']()
          break
        case 'ArrowRight':
          pageManager[verticalMode ? 'prevPage' : 'nextPage']()
          break
        case 'ArrowUp':
          pageManager.prevPage()
          break
        case 'ArrowDown':
          pageManager.nextPage()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pageManager, verticalMode])

  // Swipe gesture navigation
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      touchStartRef.current = { x: touch.clientX, y: touch.clientY }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) return

      const touch = e.changedTouches[0]
      const deltaX = touch.clientX - touchStartRef.current.x
      const deltaY = touch.clientY - touchStartRef.current.y
      const minSwipeDistance = 50

      // Only handle horizontal swipes (must be more horizontal than vertical)
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
        // In vertical-rl mode: swipe left = prev (RTL reading), swipe right = next
        // In LTR mode: swipe left = next, swipe right = prev
        const direction = deltaX < 0 ? 1 : -1
        pageManager.flipPage((verticalMode ? -direction : direction) as 1 | -1)
      }

      touchStartRef.current = null
    }

    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [pageManager, verticalMode])

  // Click handling (word selection only)
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // Only handle word lookup on text clicks
      if (isClickOnText(e.target)) {
        const selection = getClickedWordAndSentence(e.clientX, e.clientY)
        if (selection && onWordSelect) {
          onWordSelect(selection)
        }
      }
    },
    [onWordSelect]
  )

  // CSS variables for styling
  const containerStyle = useMemo<CSSProperties>(
    () => ({
      '--book-content-width': `${containerSize.width}px`,
      '--book-content-height': `${containerSize.height}px`,
      '--book-content-column-width': verticalMode ? 'auto' : `${containerSize.width}px`,
      '--reader-font-size': `${fontSize}px`,
      '--reader-line-height': `${lineHeight}`,
    } as CSSProperties),
    [containerSize.width, containerSize.height, verticalMode, fontSize, lineHeight]
  )

  if (!content) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      className={`book-content h-full w-full ${verticalMode ? 'book-content--vertical-rl' : ''}`}
      style={containerStyle}
      onClick={handleClick}
    >
      <div
        ref={contentRef}
        className="book-content-container"
        dangerouslySetInnerHTML={{ __html: content }}
      />
      {isLoading && (
        <div className="bg-background/80 absolute inset-0 flex items-center justify-center">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
      )}
    </div>
  )
}
