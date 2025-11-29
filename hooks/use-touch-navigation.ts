'use client'

import { useCallback, type RefObject, type MouseEvent } from 'react'
import { isClickOnText, getClickedWordAndSentence, type WordSelection } from './use-word-selection'

interface UseTouchNavigationOptions {
  onCenter: () => void
  onWordSelect: (selection: WordSelection) => void
}

interface UseTouchNavigationResult {
  handleClick: (e: MouseEvent) => void
}

export function useTouchNavigation(
  containerRef: RefObject<HTMLElement | null>,
  options: UseTouchNavigationOptions
): UseTouchNavigationResult {
  const { onCenter, onWordSelect } = options

  const handleClick = useCallback(
    (e: MouseEvent) => {
      // Check if click is on text or background
      if (isClickOnText(e.target)) {
        const selection = getClickedWordAndSentence(e.clientX, e.clientY)
        if (selection) {
          onWordSelect(selection)
        }
      } else {
        // Click on background opens settings
        onCenter()
      }
    },
    [onCenter, onWordSelect]
  )

  return {
    handleClick,
  }
}
