'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type DictionaryEntry } from '@/lib/db'
import { lookupWord, importDictionary, clearDictionary, type DictionaryStatus } from '@/lib/dictionary'

export function useDictionaryLookup(word: string | null) {
  const [results, setResults] = useState<DictionaryEntry[]>([])
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!word) {
      return
    }

    let cancelled = false

    startTransition(async () => {
      try {
        const entries = await lookupWord(word)
        if (!cancelled) {
          setResults(entries)
        }
      } catch {
        if (!cancelled) {
          setResults([])
        }
      }
    })

    return () => {
      cancelled = true
    }
  }, [word])

  // Clear results when word is null (derived from props, not setState in effect)
  const displayResults = word ? results : []

  return { results: displayResults, isLoading: isPending }
}

export function useDictionaryStatus() {
  const meta = useLiveQuery(async () => {
    try {
      return await db.dictionaryMeta.toArray()
    } catch {
      return []
    }
  })

  const status: DictionaryStatus = {
    installed: false,
    importing: false,
    entryCount: 0,
  }

  if (meta && Array.isArray(meta)) {
    const statusMeta = meta.find(m => m.key === 'import_status')
    const countMeta = meta.find(m => m.key === 'entry_count')

    status.installed = statusMeta?.value === 'complete'
    status.importing = statusMeta?.value === 'importing'
    status.entryCount = countMeta ? parseInt(countMeta.value, 10) : 0
  }

  return status
}

export function useDictionaryImport() {
  const [isImporting, setIsImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const startImport = useCallback(async () => {
    setIsImporting(true)
    setProgress(0)
    setError(null)

    try {
      await importDictionary((p) => setProgress(p))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setIsImporting(false)
    }
  }, [])

  const clear = useCallback(async () => {
    await clearDictionary()
  }, [])

  return { startImport, clear, isImporting, progress, error }
}
