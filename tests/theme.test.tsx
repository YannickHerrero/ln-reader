import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ThemeToggle } from '../src/components/ThemeToggle'
import { ThemeProvider } from '../src/theme/ThemeProvider'

afterEach(() => {
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.style.removeProperty('color-scheme')
})

describe('appearance theme', () => {
  it('restores and persists an explicit theme', async () => {
    localStorage.setItem('ln-reader-theme', 'dark')
    render(<ThemeProvider><ThemeToggle /></ThemeProvider>)

    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'))
    await userEvent.click(screen.getByRole('button', { name: 'Activer le thème clair' }))

    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('ln-reader-theme')).toBe('light')
    expect(screen.getByRole('button', { name: 'Activer le thème sombre' })).toBeInTheDocument()
  })

  it('uses the system preference when no choice is stored', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))

    render(<ThemeProvider><ThemeToggle /></ThemeProvider>)

    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'))
    expect(localStorage.getItem('ln-reader-theme')).toBeNull()
  })
})
