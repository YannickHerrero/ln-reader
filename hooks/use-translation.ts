'use client'

import { useState, useEffect, useCallback } from 'react'

const CACHE_KEY = 'ln-reader-translations'

// Simple hash function for cache keys
function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return hash.toString(36)
}

function getCache(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    return cached ? JSON.parse(cached) : {}
  } catch {
    return {}
  }
}

function setCache(key: string, value: string): void {
  if (typeof window === 'undefined') return
  try {
    const cache = getCache()
    cache[key] = value
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // localStorage might be full or unavailable
  }
}

function getCachedTranslation(text: string): string | null {
  const cacheKey = hashString(text)
  const cache = getCache()
  return cache[cacheKey] ?? null
}

export function useTranslation(text: string | null) {
  // Initialize with cached value if available
  const [translation, setTranslation] = useState<string | null>(() => {
    if (!text) return null
    return getCachedTranslation(text)
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTranslation = useCallback(async (textToTranslate: string) => {
    const cacheKey = hashString(textToTranslate)

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToTranslate }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Translation failed')
      }

      const data = await res.json()
      setTranslation(data.translation)
      setCache(cacheKey, data.translation)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Translation failed')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!text) return

    // Check cache first
    const cached = getCachedTranslation(text)
    if (cached) {
      setTranslation(cached)
      return
    }

    // Fetch if not cached
    fetchTranslation(text)
  }, [text, fetchTranslation])

  // Reset when text becomes null
  const translationResult = text ? translation : null
  const errorResult = text ? error : null

  return { translation: translationResult, isLoading, error: errorResult }
}
