import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ThemeContext, type Theme, type ThemeContextValue } from './theme-context'

const STORAGE_KEY = 'ln-reader-theme'
const THEME_COLORS: Record<Theme, string> = {
  light: '#f5f5f7',
  dark: '#09090b',
}

function storedTheme(): Theme | null {
  const value = localStorage.getItem(STORAGE_KEY)
  return value === 'light' || value === 'dark' ? value : null
}

function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme])
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, updateTheme] = useState<Theme>(() => storedTheme() ?? systemTheme())

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    if (storedTheme()) return
    const query = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!query) return
    const change = (event: MediaQueryListEvent) => updateTheme(event.matches ? 'dark' : 'light')
    query.addEventListener?.('change', change)
    return () => query.removeEventListener?.('change', change)
  }, [])

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    setTheme(nextTheme) {
      localStorage.setItem(STORAGE_KEY, nextTheme)
      updateTheme(nextTheme)
    },
    toggleTheme() {
      const nextTheme = theme === 'dark' ? 'light' : 'dark'
      localStorage.setItem(STORAGE_KEY, nextTheme)
      updateTheme(nextTheme)
    },
  }), [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
