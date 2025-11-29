'use client'

import { type ReactNode, type MouseEvent } from 'react'

interface ReaderNavigationProps {
  children: ReactNode
  onClick: (e: MouseEvent) => void
}

export function ReaderNavigation({
  children,
  onClick,
}: ReaderNavigationProps) {
  return (
    <div
      className="relative h-full w-full"
      onClick={onClick}
    >
      {children}
    </div>
  )
}
