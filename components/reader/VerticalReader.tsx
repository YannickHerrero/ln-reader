'use client'

import { useRef, useState, useEffect, useCallback, type CSSProperties } from 'react'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel'
import { useContentPages, type PageContent } from '@/hooks/use-content-pages'
import type { ReaderSettings } from '@/hooks/use-reader-settings'
import { isClickOnText, getClickedWordAndSentence, type WordSelection } from '@/hooks/use-word-selection'

interface VerticalReaderProps {
  content: string | null
  settings: ReaderSettings
  onPageChange?: (page: number, total: number) => void
  onOpenSettings: () => void
  onWordSelect: (selection: WordSelection) => void
}

export function VerticalReader({
  content,
  settings,
  onPageChange,
  onOpenSettings,
  onWordSelect,
}: VerticalReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [api, setApi] = useState<CarouselApi>()
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

  const { fontSize, lineHeight } = settings

  // Measure container size
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateSize = () => {
      setContainerSize({
        width: container.clientWidth,
        height: container.clientHeight,
      })
    }

    updateSize()

    const resizeObserver = new ResizeObserver(updateSize)
    resizeObserver.observe(container)

    return () => resizeObserver.disconnect()
  }, [])

  // Split content into pages
  const pages = useContentPages(
    content,
    fontSize,
    lineHeight,
    containerSize.width,
    containerSize.height
  )

  // Track page changes
  useEffect(() => {
    if (!api) return

    const onSelect = () => {
      const page = api.selectedScrollSnap()
      const snapList = api.scrollSnapList()
      console.log('[VerticalReader] Page selected:', {
        page,
        totalSnaps: snapList.length,
        snapList,
        pagesLength: pages.length,
      })
      onPageChange?.(page, pages.length)
    }

    api.on('select', onSelect)
    onSelect() // Initial call

    return () => {
      api.off('select', onSelect)
    }
  }, [api, pages.length, onPageChange])

  // Debug: log pages
  useEffect(() => {
    console.log('[VerticalReader] Pages calculated:', {
      pagesCount: pages.length,
      containerSize,
      fontSize,
      lineHeight,
    })
  }, [pages.length, containerSize, fontSize, lineHeight])

  // Handle click on content
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isClickOnText(e.target)) {
        const selection = getClickedWordAndSentence(e.clientX, e.clientY)
        if (selection) {
          onWordSelect(selection)
        }
      } else {
        onOpenSettings()
      }
    },
    [onOpenSettings, onWordSelect]
  )

  // Expose navigation functions
  useEffect(() => {
    if (!api) return
    // Store on window for external access if needed
    ;(window as unknown as { verticalReaderApi?: CarouselApi }).verticalReaderApi = api
  }, [api])

  const containerStyle: CSSProperties = {
    '--reader-font-size': `${fontSize}px`,
    '--reader-line-height': `${lineHeight}`,
  } as CSSProperties

  if (!content) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading chapter...</div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="vertical-reader-container h-full w-full"
      style={containerStyle}
      onClick={handleClick}
      dir="rtl"
    >
      {containerSize.width > 0 && containerSize.height > 0 && pages.length > 0 && (
        <Carousel
          opts={{
            direction: 'rtl',
            align: 'start',
            loop: false,
          }}
          setApi={setApi}
          className="h-full w-full"
        >
          <CarouselContent className="h-full ml-0">
            {pages.map((page, index) => (
              <CarouselItem key={index} className="h-full pl-0 basis-full">
                <PageRenderer page={page} />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      )}
    </div>
  )
}

function PageRenderer({ page }: { page: PageContent }) {
  if (page.type === 'image') {
    return (
      <div className="flex h-full w-full items-center justify-center p-4">
        <div
          className="h-full w-full"
          dangerouslySetInnerHTML={{ __html: page.content }}
        />
      </div>
    )
  }

  return (
    <div
      className="vertical-reader-page"
      dangerouslySetInnerHTML={{ __html: page.content }}
    />
  )
}

// Export navigation helper
export function useVerticalReaderNavigation() {
  const getApi = () =>
    (window as unknown as { verticalReaderApi?: CarouselApi }).verticalReaderApi

  return {
    nextPage: () => getApi()?.scrollNext(),
    prevPage: () => getApi()?.scrollPrev(),
    goToPage: (page: number) => getApi()?.scrollTo(page),
    getCurrentPage: () => getApi()?.selectedScrollSnap() ?? 0,
    getTotalPages: () => getApi()?.scrollSnapList().length ?? 0,
  }
}
