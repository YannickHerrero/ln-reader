'use client'

import { forwardRef, useEffect, type CSSProperties } from 'react'
import type { ReaderSettings } from '@/hooks/use-reader-settings'

interface ReaderContentProps {
  content: string | null
  settings: ReaderSettings
  onContentReady?: () => void
}

export const ReaderContent = forwardRef<HTMLDivElement, ReaderContentProps>(
  function ReaderContent({ content, settings, onContentReady }, ref) {
    const { fontSize, lineHeight, direction } = settings

    useEffect(() => {
      if (content) {
        // Notify parent that content is ready for pagination calculation
        const timer = setTimeout(() => {
          onContentReady?.()
        }, 100)
        return () => clearTimeout(timer)
      }
    }, [content, onContentReady])

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
        ref={ref}
        className="reader-paginator h-full w-full"
        style={containerStyle}
        data-direction={direction}
      >
        <div
          className="reader-content"
          data-direction={direction}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>
    )
  }
)
