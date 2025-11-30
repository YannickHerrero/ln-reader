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
import type { ReaderSettings } from '@/hooks/use-reader-settings'
import {
  getClickedWordAndSentence,
  isClickOnText,
  type WordSelection,
} from '@/hooks/use-word-selection'

/**
 * Wait for all images in an element to load
 */
function waitForImages(element: HTMLElement, maxWait = 2000): Promise<void> {
  const images = element.querySelectorAll('img')
  if (images.length === 0) return Promise.resolve()

  return Promise.race([
    Promise.all(
      Array.from(images).map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.onload = () => resolve()
              img.onerror = () => resolve()
            })
      )
    ).then(() => {}),
    new Promise<void>((resolve) => setTimeout(resolve, maxWait)),
  ])
}

/**
 * Wait for CSS column layout to stabilize by polling scroll dimensions
 */
function waitForStableLayout(
  element: HTMLElement,
  vertical: boolean,
  maxAttempts = 60
): Promise<void> {
  return new Promise((resolve) => {
    let lastSize = vertical ? element.scrollHeight : element.scrollWidth
    let stableCount = 0
    let attempts = 0

    const check = () => {
      const currentSize = vertical ? element.scrollHeight : element.scrollWidth

      if (currentSize === lastSize && currentSize > 0) {
        stableCount++
        if (stableCount >= 5) {
          resolve()
          return
        }
      } else {
        stableCount = 0
        lastSize = currentSize
      }

      attempts++
      if (attempts >= maxAttempts) {
        resolve()
        return
      }

      requestAnimationFrame(check)
    }

    requestAnimationFrame(check)
  })
}

/**
 * Wait for images to load, then wait for layout to stabilize
 */
async function waitForImagesAndLayout(
  element: HTMLElement,
  vertical: boolean
): Promise<void> {
  if (document.fonts?.ready) {
    await document.fonts.ready
  }
  await waitForImages(element)
  await waitForStableLayout(element, vertical)
}

interface BookReaderProps {
  /** HTML content to display */
  content: string | null
  /** Scoped CSS stylesheet from EPUB */
  styleSheet?: string
  /** Reader settings (font size, line height, direction) */
  settings: ReaderSettings
  /** Saved scroll percentage to restore (0-1) */
  savedScrollPercent?: number
  /** Callback when scroll percentage changes */
  onScrollPercentChange?: (percent: number) => void
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
  styleSheet,
  settings,
  savedScrollPercent = 0,
  onScrollPercentChange,
  onPrevChapter,
  onNextChapter,
  onWordSelect,
}: BookReaderProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [isReady, setIsReady] = useState(false)
  const restoredRef = useRef(false)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  const { fontSize, lineHeight, direction } = settings
  const verticalMode = direction === 'vertical-rl'

  // Derive loading state
  const isLoading = !isReady && !!content

  /**
   * Calculate scroll percentage from current scroll position
   */
  const getScrollPercent = useCallback(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl) return 0

    const scrollSize = verticalMode ? scrollEl.scrollHeight : scrollEl.scrollWidth
    const viewportSize = verticalMode ? scrollEl.clientHeight : scrollEl.clientWidth
    const maxScroll = scrollSize - viewportSize
    const currentScroll = verticalMode ? scrollEl.scrollTop : scrollEl.scrollLeft

    return maxScroll > 0 ? currentScroll / maxScroll : 0
  }, [verticalMode])

  /**
   * Scroll to a given percentage
   */
  const scrollToPercent = useCallback(
    (percent: number) => {
      const scrollEl = scrollRef.current
      if (!scrollEl) return

      const scrollSize = verticalMode ? scrollEl.scrollHeight : scrollEl.scrollWidth
      const viewportSize = verticalMode ? scrollEl.clientHeight : scrollEl.clientWidth
      const maxScroll = scrollSize - viewportSize
      const targetScroll = percent * maxScroll

      scrollEl.scrollTo({
        [verticalMode ? 'top' : 'left']: targetScroll,
      })
    },
    [verticalMode]
  )

  // Inject scoped stylesheet from EPUB
  useEffect(() => {
    if (!styleSheet) return

    const style = document.createElement('style')
    style.textContent = styleSheet
    document.head.appendChild(style)

    return () => {
      style.remove()
    }
  }, [styleSheet])

  // Handle page change - report scroll percentage
  const handlePageChange = useCallback(() => {
    const percent = getScrollPercent()
    onScrollPercentChange?.(percent)
  }, [getScrollPercent, onScrollPercentChange])

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
    onPageChange: handlePageChange,
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

  // Wait for content to be ready (images loaded, layout stable)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    restoredRef.current = false
    setIsReady(false)

    if (!contentRef.current || !scrollRef.current || !content) {
      return
    }

    let cancelled = false

    const init = async () => {
      if (!scrollRef.current) return

      await waitForImagesAndLayout(scrollRef.current, verticalMode)

      if (cancelled) return
      setIsReady(true)
    }

    init()

    return () => {
      cancelled = true
    }
  }, [content, verticalMode, fontSize, lineHeight])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Restore saved scroll position
  useEffect(() => {
    if (
      isReady &&
      savedScrollPercent > 0 &&
      !restoredRef.current &&
      containerSize.width > 0
    ) {
      restoredRef.current = true
      scrollToPercent(savedScrollPercent)
      onScrollPercentChange?.(savedScrollPercent)
    }
  }, [isReady, savedScrollPercent, containerSize.width, scrollToPercent, onScrollPercentChange])

  // Track scroll percentage on scroll events
  useEffect(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl || !isReady) return

    let rafId: number | null = null

    const handleScroll = () => {
      if (rafId) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        const percent = getScrollPercent()
        onScrollPercentChange?.(percent)
      })
    }

    scrollEl.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      scrollEl.removeEventListener('scroll', handleScroll)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [isReady, getScrollPercent, onScrollPercentChange])

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

      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
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
        <div className="bg-background absolute inset-0 flex items-center justify-center">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
      )}
    </div>
  )
}
