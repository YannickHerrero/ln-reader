'use client'

/**
 * Page Manager Hook
 * Handles pagination navigation using CSS columns
 * Adapted from TTU Ebook Reader's PageManagerPaginated
 */

import {
  useCallback,
  useRef,
  useState,
  type RefObject,
  useEffect,
} from 'react'
import type { PageManagerApi } from './types'

export interface UsePageManagerOptions {
  /** Content element ref (inner container) */
  contentRef: RefObject<HTMLElement | null>
  /** Scroll element ref (outer container with overflow) */
  scrollRef: RefObject<HTMLElement | null>
  /** Viewport width */
  width: number
  /** Viewport height */
  height: number
  /** Whether in vertical reading mode */
  verticalMode: boolean
  /** Gap between pages (default: 40px to match TTU) */
  pageGap?: number
  /** Callback when navigating to previous section/chapter */
  onPrevSection?: () => void
  /** Callback when navigating to next section/chapter */
  onNextSection?: () => void
  /** Callback when page changes */
  onPageChange?: (virtualScrollPos: number, isUser: boolean) => void
}

/**
 * Hook for managing paginated content navigation
 */
export function usePageManager({
  contentRef,
  scrollRef,
  width,
  height,
  verticalMode,
  pageGap = 40,
  onPrevSection,
  onNextSection,
  onPageChange,
}: UsePageManagerOptions): PageManagerApi {
  const [virtualScrollPos, setVirtualScrollPos] = useState(0)
  const translateXRef = useRef(0)

  /**
   * Get the total scroll size of the content
   */
  const getScrollSize = useCallback(() => {
    if (!scrollRef.current) return 0
    return scrollRef.current[verticalMode ? 'scrollHeight' : 'scrollWidth']
  }, [scrollRef, verticalMode])

  /**
   * Get the viewport size
   */
  const getViewportSize = useCallback(() => {
    return verticalMode ? height : width
  }, [verticalMode, width, height])

  /**
   * Scroll to a position using native scroll
   */
  const scrollToPos = useCallback(
    (pos: number, isUser: boolean) => {
      if (!scrollRef.current) return

      setVirtualScrollPos(pos)
      scrollRef.current.scrollTo({
        [verticalMode ? 'top' : 'left']: pos,
      })
      onPageChange?.(pos, isUser)
    },
    [scrollRef, verticalMode, onPageChange]
  )

  /**
   * Move content using CSS transform (for edge cases)
   */
  const translateXToPos = useCallback(
    (pos: number, isUser: boolean) => {
      if (!contentRef.current) return

      setVirtualScrollPos(-pos)
      contentRef.current.style.transform = `translateX(${pos}px)`
      translateXRef.current = pos
      onPageChange?.(-pos, isUser)
    },
    [contentRef, onPageChange]
  )

  /**
   * Clear any translateX transform
   */
  const clearTranslateX = useCallback(() => {
    if (!contentRef.current) return
    contentRef.current.style.removeProperty('transform')
    translateXRef.current = 0
  }, [contentRef])

  /**
   * Scroll or translate to position based on content bounds
   */
  const scrollOrTranslateToPos = useCallback(
    (pos: number, isUser: boolean) => {
      const scrollSize = getScrollSize()
      const viewportSize = getViewportSize()

      if (verticalMode) {
        scrollToPos(pos, isUser)
        return
      }

      const screenRight = pos + viewportSize
      if (screenRight <= scrollSize) {
        scrollToPos(pos, isUser)
      } else {
        // Use translateX for partial pages at content end
        translateXToPos(-pos, isUser)
      }
    },
    [verticalMode, getScrollSize, getViewportSize, scrollToPos, translateXToPos]
  )

  /**
   * Navigate to previous section/chapter
   */
  const prevSection = useCallback(
    (_offset: number, _isUser: boolean) => {
      if (!onPrevSection) return false

      // Will be called, and after render we'll scroll to end of prev section
      onPrevSection()
      return true
    },
    [onPrevSection]
  )

  /**
   * Navigate to next section/chapter
   */
  const nextSection = useCallback(
    (_isUser: boolean) => {
      if (!onNextSection) return false

      onNextSection()
      return true
    },
    [onNextSection]
  )

  /**
   * Flip page forward or backward
   */
  const flipPage = useCallback(
    (multiplier: 1 | -1) => {
      const viewportSize = getViewportSize()
      const offset = viewportSize + pageGap
      const isUser = true

      // If we have a translateX active, handle it specially
      if (translateXRef.current) {
        if (multiplier < 0) {
          const prevTranslateX = translateXRef.current
          clearTranslateX()
          scrollOrTranslateToPos(-prevTranslateX - offset, isUser)
          return
        }

        if (nextSection(isUser)) {
          clearTranslateX()
          return
        }
        return
      }

      const scrollSize = getScrollSize()
      const currentValue = virtualScrollPos
      const newValue = currentValue + offset * multiplier
      const newValueCeil = Math.ceil(newValue)

      const minValue = 0
      const maxValue = scrollSize

      // Going before start - try previous section
      if (newValueCeil < minValue) {
        if (currentValue !== minValue) {
          scrollOrTranslateToPos(minValue, isUser)
          return
        }
        prevSection(offset, isUser)
        return
      }

      // Going past end - try next section
      if (newValueCeil >= maxValue) {
        nextSection(isUser)
        return
      }

      // Normal page navigation
      scrollOrTranslateToPos(newValue, isUser)
    },
    [
      virtualScrollPos,
      pageGap,
      getViewportSize,
      getScrollSize,
      scrollOrTranslateToPos,
      prevSection,
      nextSection,
      clearTranslateX,
    ]
  )

  /**
   * Navigate to next page
   */
  const nextPage = useCallback(() => {
    flipPage(1)
  }, [flipPage])

  /**
   * Navigate to previous page
   */
  const prevPage = useCallback(() => {
    flipPage(-1)
  }, [flipPage])

  /**
   * Scroll to a specific position
   */
  const scrollTo = useCallback(
    (pos: number, isUser: boolean) => {
      clearTranslateX()
      scrollOrTranslateToPos(pos, isUser)
    },
    [clearTranslateX, scrollOrTranslateToPos]
  )

  /**
   * Force recalculation (e.g., after resize)
   */
  const recalculate = useCallback(() => {
    // Force a re-render by triggering layout
    if (scrollRef.current) {
      // This forces a reflow
      void scrollRef.current.offsetHeight
    }
  }, [scrollRef])

  // Reset position when content changes
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setVirtualScrollPos(0)
    clearTranslateX()
  }, [width, height, clearTranslateX])
  /* eslint-enable react-hooks/set-state-in-effect */

  return {
    virtualScrollPos,
    nextPage,
    prevPage,
    flipPage,
    scrollTo,
    recalculate,
  }
}
