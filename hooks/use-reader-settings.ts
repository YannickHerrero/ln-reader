'use client'

import { useEffect, useCallback, useSyncExternalStore, useMemo, useRef } from 'react'

export interface ReaderSettings {
  theme: 'light' | 'dark'
  fontSize: number
  lineHeight: number
  direction: 'ltr' | 'vertical-rl'
}

const STORAGE_KEY = 'ln-reader-settings'

const DEFAULT_SETTINGS: ReaderSettings = {
  theme: 'dark',
  fontSize: 18,
  lineHeight: 1.6,
  direction: 'vertical-rl',
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

export function useReaderSettings() {
  // Use useSyncExternalStore for proper SSR hydration
  const storedValue = useSyncExternalStore(
    subscribeToStorage,
    getSnapshot,
    getServerSnapshot
  )

  // Derive settings from stored value
  const settings = useMemo<ReaderSettings>(() => {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(storedValue) }
    } catch {
      return DEFAULT_SETTINGS
    }
  }, [storedValue])

  // Save to localStorage
  const setSettings = useCallback((updates: Partial<ReaderSettings>) => {
    const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || JSON.stringify(DEFAULT_SETTINGS))
    const newSettings = { ...current, ...updates }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings))
    // Dispatch storage event to trigger update
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))
  }, [])

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement
    if (settings.theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [settings.theme])

  // Track hydration using a ref that gets set after first render
  const isHydratedRef = useRef(false)
  const isHydrated = useSyncExternalStore(
    () => () => {},
    () => {
      isHydratedRef.current = true
      return true
    },
    () => false
  )

  return { settings, setSettings, isHydrated }
}
