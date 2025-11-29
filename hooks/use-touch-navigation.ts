'use client'

import { useRef, useCallback, type RefObject, type MouseEvent, type TouchEvent } from 'react'

interface UseTouchNavigationOptions {
  direction: 'ltr' | 'vertical-rl'
  onNext: () => void
  onPrev: () => void
  onCenter: () => void
}

interface UseTouchNavigationResult {
  handleTouchStart: (e: TouchEvent) => void
  handleTouchEnd: (e: TouchEvent) => void
  handleClick: (e: MouseEvent) => void
}

const SWIPE_THRESHOLD = 50

export function useTouchNavigation(
  containerRef: RefObject<HTMLElement | null>,
  options: UseTouchNavigationOptions
): UseTouchNavigationResult {
  const { direction, onNext, onPrev, onCenter } = options
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    }
  }, [])

  const handleTapPosition = useCallback(
    (clientX: number) => {
      const container = containerRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      const x = clientX - rect.left
      const xPercent = x / rect.width

      if (direction === 'ltr') {
        // LTR: left 20% = prev, right 20% = next, center = settings
        if (xPercent < 0.2) {
          onPrev()
        } else if (xPercent > 0.8) {
          onNext()
        } else {
          onCenter()
        }
      } else {
        // Vertical-rl: left 20% = next, right 20% = prev, center = settings
        if (xPercent < 0.2) {
          onNext()
        } else if (xPercent > 0.8) {
          onPrev()
        } else {
          onCenter()
        }
      }
    },
    [containerRef, direction, onNext, onPrev, onCenter]
  )

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!touchStartRef.current) return

      const touchEnd = {
        x: e.changedTouches[0].clientX,
        y: e.changedTouches[0].clientY,
      }

      const deltaX = touchEnd.x - touchStartRef.current.x
      const deltaY = touchEnd.y - touchStartRef.current.y
      const absDeltaX = Math.abs(deltaX)
      const absDeltaY = Math.abs(deltaY)

      // Check if it's a horizontal swipe
      if (absDeltaX > SWIPE_THRESHOLD && absDeltaX > absDeltaY) {
        if (direction === 'ltr') {
          // LTR: swipe left = next, swipe right = prev
          if (deltaX > 0) {
            onPrev()
          } else {
            onNext()
          }
        } else {
          // Vertical-rl: swipe left = prev, swipe right = next
          if (deltaX > 0) {
            onNext()
          } else {
            onPrev()
          }
        }
      } else if (absDeltaX < 10 && absDeltaY < 10) {
        // It's a tap, not a swipe - handle based on position
        handleTapPosition(touchEnd.x)
      }

      touchStartRef.current = null
    },
    [direction, onNext, onPrev, handleTapPosition]
  )

  const handleClick = useCallback(
    (e: MouseEvent) => {
      handleTapPosition(e.clientX)
    },
    [handleTapPosition]
  )

  return {
    handleTouchStart,
    handleTouchEnd,
    handleClick,
  }
}
