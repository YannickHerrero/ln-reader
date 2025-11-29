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
  /** Callback when user clicks center area (open settings) */
  onOpenSettings?: () => void
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
  onOpenSettings,
  onWordSelect,
}: BookReaderProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [calculator, setCalculator] = useState<CharacterStatsCalculator | null>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const restoredRef = useRef(false)

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
        if (calculator) {
          const explored = calculator.getCharCountByScrollPos(pos)
          onCharCountChange?.(explored, calculator.charCount)
        }
      },
      [calculator, onCharCountChange]
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

  // Mouse wheel navigation
  useEffect(() => {
    let lastWheelTime = 0
    const throttleMs = 100

    const handleWheel = (e: WheelEvent) => {
      const now = Date.now()
      if (now - lastWheelTime < throttleMs) return
      lastWheelTime = now

      let multiplier = (e.deltaX < 0 ? -1 : 1) * (verticalMode ? -1 : 1)
      if (!e.deltaX) {
        multiplier = e.deltaY < 0 ? -1 : 1
      }
      pageManager.flipPage(multiplier as 1 | -1)
    }

    document.body.addEventListener('wheel', handleWheel, { passive: true })
    return () => document.body.removeEventListener('wheel', handleWheel)
  }, [pageManager, verticalMode])

  // Click handling
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // Check if click is on text (for word lookup)
      if (isClickOnText(e.target)) {
        const selection = getClickedWordAndSentence(e.clientX, e.clientY)
        if (selection && onWordSelect) {
          onWordSelect(selection)
          return
        }
      }

      // Otherwise, open settings on background click
      onOpenSettings?.()
    },
    [onWordSelect, onOpenSettings]
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
