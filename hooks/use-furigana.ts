'use client'

import { useState, useEffect, useTransition } from 'react'
import { addFurigana } from '@/lib/kuroshiro'

export function useFurigana(text: string | null) {
  const [html, setHtml] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!text) {
      return
    }

    let cancelled = false

    startTransition(async () => {
      try {
        const result = await addFurigana(text)
        if (!cancelled) {
          setHtml(result)
        }
      } catch (error) {
        console.error('Failed to add furigana:', error)
        if (!cancelled) {
          setHtml(null)
        }
      }
    })

    return () => {
      cancelled = true
    }
  }, [text])

  // Clear html when text is null
  const displayHtml = text ? html : null

  return { html: displayHtml, isLoading: isPending }
}
