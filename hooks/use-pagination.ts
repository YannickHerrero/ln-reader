'use client'

import { useState, useCallback, useEffect, type RefObject } from 'react'

interface UsePaginationOptions {
  direction: 'ltr' | 'vertical-rl'
  onPageChange?: (page: number) => void
}

interface UsePaginationResult {
  currentPage: number
  totalPages: number
  goToPage: (page: number) => void
  nextPage: () => boolean
  prevPage: () => boolean
  recalculate: () => void
}

export function usePagination(
  containerRef: RefObject<HTMLDivElement | null>,
  options: UsePaginationOptions
): UsePaginationResult {
  const { direction, onPageChange } = options
  const [currentPage, setCurrentPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const recalculate = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const scrollWidth = container.scrollWidth
    const clientWidth = container.clientWidth

    if (clientWidth > 0) {
      const pages = Math.max(1, Math.ceil(scrollWidth / clientWidth))
      setTotalPages(pages)

      // Ensure current page is valid
      setCurrentPage((prev) => Math.min(prev, pages - 1))
    }
  }, [containerRef])

  const goToPage = useCallback(
    (page: number) => {
      const container = containerRef.current
      if (!container) return

      const clampedPage = Math.max(0, Math.min(page, totalPages - 1))

      if (direction === 'ltr') {
        container.scrollLeft = clampedPage * container.clientWidth
      } else {
        // Vertical-rl: pages flow right-to-left
        // Page 0 is at the rightmost position
        const maxScroll = container.scrollWidth - container.clientWidth
        container.scrollLeft = maxScroll - clampedPage * container.clientWidth
      }

      setCurrentPage(clampedPage)
      onPageChange?.(clampedPage)
    },
    [containerRef, direction, totalPages, onPageChange]
  )

  const nextPage = useCallback((): boolean => {
    if (currentPage < totalPages - 1) {
      goToPage(currentPage + 1)
      return true
    }
    return false
  }, [currentPage, totalPages, goToPage])

  const prevPage = useCallback((): boolean => {
    if (currentPage > 0) {
      goToPage(currentPage - 1)
      return true
    }
    return false
  }, [currentPage, goToPage])

  // Recalculate on resize
  useEffect(() => {
    const handleResize = () => {
      recalculate()
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [recalculate])

  // Initial calculation after content renders
  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM has updated
    const frame = requestAnimationFrame(() => {
      recalculate()
    })
    return () => cancelAnimationFrame(frame)
  }, [recalculate])

  return {
    currentPage,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    recalculate,
  }
}
