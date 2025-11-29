'use client'

import { useState, useCallback, useEffect, useRef, type RefObject } from 'react'

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

  // Use refs to avoid recreating callbacks and causing infinite loops
  const totalPagesRef = useRef(totalPages)
  const directionRef = useRef(direction)
  const onPageChangeRef = useRef(onPageChange)

  // Keep refs in sync
  useEffect(() => {
    totalPagesRef.current = totalPages
  }, [totalPages])

  useEffect(() => {
    directionRef.current = direction
  }, [direction])

  useEffect(() => {
    onPageChangeRef.current = onPageChange
  }, [onPageChange])

  const recalculate = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const content = container.querySelector('.reader-content') as HTMLElement
    if (!content) return

    // Force layout recalculation
    void container.offsetHeight

    // Temporarily reset transform to measure true content size
    const savedTransform = content.style.transform
    content.style.transform = 'translateX(0)'

    // Wait for layout to update
    void content.offsetWidth

    const pageWidth = container.clientWidth
    const totalWidth = content.scrollWidth

    console.log('[Pagination] recalculate:', {
      direction,
      containerClientWidth: container.clientWidth,
      containerClientHeight: container.clientHeight,
      containerScrollWidth: container.scrollWidth,
      containerScrollHeight: container.scrollHeight,
      contentScrollWidth: content.scrollWidth,
      contentScrollHeight: content.scrollHeight,
      contentOffsetWidth: content.offsetWidth,
      contentOffsetHeight: content.offsetHeight,
      pageWidth,
      totalWidth,
      calculatedPages: Math.ceil(totalWidth / pageWidth),
    })

    // Restore transform
    content.style.transform = savedTransform

    if (pageWidth > 0 && totalWidth > 0) {
      const pages = Math.max(1, Math.ceil(totalWidth / pageWidth))
      setTotalPages(pages)

      // Ensure current page is valid
      setCurrentPage((prev) => Math.min(prev, pages - 1))
    }
  }, [containerRef, direction])

  const goToPage = useCallback(
    (page: number) => {
      const container = containerRef.current
      if (!container) return

      const content = container.querySelector('.reader-content') as HTMLElement
      if (!content) return

      const currentTotalPages = totalPagesRef.current
      const currentDirection = directionRef.current

      const clampedPage = Math.max(0, Math.min(page, currentTotalPages - 1))
      const pageWidth = container.clientWidth

      let transform: string
      if (currentDirection === 'vertical-rl') {
        // For vertical Japanese text, content starts at right, pages flow right-to-left
        // Page 0 shows rightmost content, so we need to offset by (totalWidth - containerWidth)
        // Then each page moves LEFT (reduces the offset)
        const totalWidth = content.scrollWidth
        const maxOffset = totalWidth - pageWidth
        const offset = maxOffset - (clampedPage * pageWidth)
        transform = `translateX(-${Math.max(0, offset)}px)`
      } else {
        // For LTR text, pages flow left-to-right
        // Page 0 is at the left, higher pages move right (negative translateX)
        transform = `translateX(-${clampedPage * pageWidth}px)`
      }

      console.log('[Pagination] goToPage:', {
        direction: currentDirection,
        page,
        clampedPage,
        totalPages: currentTotalPages,
        pageWidth,
        contentScrollWidth: content.scrollWidth,
        transform,
      })

      content.style.transform = transform
      setCurrentPage(clampedPage)
      onPageChangeRef.current?.(clampedPage)
    },
    [containerRef]
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
