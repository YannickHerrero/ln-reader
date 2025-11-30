'use client'

import { useCallback, useSyncExternalStore, useMemo } from 'react'

export type LibrarySortOrder =
  | 'last-opened'
  | 'last-added'
  | 'progress'
  | 'title'
  | 'author'

export interface LibrarySettings {
  sortOrder: LibrarySortOrder
}

const STORAGE_KEY = 'ln-reader-library-settings'

const DEFAULT_SETTINGS: LibrarySettings = {
  sortOrder: 'last-opened',
}

function subscribeToStorage(callback: () => void) {
  window.addEventListener('storage', callback)
  return () => window.removeEventListener('storage', callback)
}

function getSnapshot(): string {
  return localStorage.getItem(STORAGE_KEY) || JSON.stringify(DEFAULT_SETTINGS)
}

function getServerSnapshot(): string {
  return JSON.stringify(DEFAULT_SETTINGS)
}

export function useLibrarySettings() {
  const storedValue = useSyncExternalStore(
    subscribeToStorage,
    getSnapshot,
    getServerSnapshot
  )

  const settings = useMemo<LibrarySettings>(() => {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(storedValue) }
    } catch {
      return DEFAULT_SETTINGS
    }
  }, [storedValue])

  const setSettings = useCallback((updates: Partial<LibrarySettings>) => {
    const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || JSON.stringify(DEFAULT_SETTINGS))
    const newSettings = { ...current, ...updates }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings))
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))
  }, [])

  return { settings, setSettings }
}
