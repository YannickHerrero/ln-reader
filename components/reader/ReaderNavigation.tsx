'use client'

import { type ReactNode, type MouseEvent, type TouchEvent } from 'react'

interface ReaderNavigationProps {
  children: ReactNode
  onTouchStart: (e: TouchEvent) => void
  onTouchEnd: (e: TouchEvent) => void
  onClick: (e: MouseEvent) => void
}

export function ReaderNavigation({
  children,
  onTouchStart,
  onTouchEnd,
  onClick,
}: ReaderNavigationProps) {
  return (
    <div
      className="relative h-full w-full touch-pan-y select-none"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
