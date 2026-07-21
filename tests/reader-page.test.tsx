import { MemoryRouter } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SourceSeries } from '../shared/contracts'
import { App } from '../src/app/App'
import { encodeRouteKey } from '../src/app/route-key'
import { db } from '../src/db/database'
import { libraryRepository } from '../src/db/repository'

const series: SourceSeries = {
  key: '/oeuvre/example/',
  title: 'Example Novel',
  sources: [{ source: 'mangasOrigines', key: '/oeuvre/example/' }],
  coverImage: null,
  author: null,
  description: null,
  genres: ['Novel'],
  status: null,
  chapters: [
    { key: '/oeuvre/example/chapitre-2/', title: 'Chapitre 2', number: 2, publishedAt: null, releases: [{ source: 'mangasOrigines', key: '/oeuvre/example/chapitre-2/' }] },
    { key: '/oeuvre/example/chapitre-1/', title: 'Chapitre 1', number: 1, publishedAt: null, releases: [{ source: 'mangasOrigines', key: '/oeuvre/example/chapitre-1/' }] },
  ],
}

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()))
  await libraryRepository.addOrUpdateSeries(series)
  await libraryRepository.downloadChapter(series.key, {
    key: series.chapters[1]!.key,
    title: 'Chapitre 1',
    html: '<p>Contenu téléchargé.</p>',
    source: 'mangasOrigines',
  })
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('reader page', () => {
  it('renders a downloaded chapter and chapter navigation without fetching', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const route = `/read/${encodeRouteKey(series.key)}/${encodeRouteKey(series.chapters[1]!.key)}`
    const { unmount } = render(<MemoryRouter initialEntries={[route]}><App /></MemoryRouter>)

    expect(await screen.findByText('Contenu téléchargé.')).toBeInTheDocument()
    expect(screen.getByText(/Disponible hors ligne/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Chapitre 2/ })).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()

    unmount()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  it('customizes and persists the reading appearance', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const route = `/read/${encodeRouteKey(series.key)}/${encodeRouteKey(series.chapters[1]!.key)}`
    const { container, unmount } = render(<MemoryRouter initialEntries={[route]}><App /></MemoryRouter>)

    expect(await screen.findByText('Contenu téléchargé.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Options de lecture' }))

    expect(screen.getByRole('dialog', { name: 'Apparence du texte' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Augmenter la taille du texte' }))
    await userEvent.click(screen.getByRole('button', { name: 'Augmenter l’interligne' }))
    await userEvent.click(screen.getByRole('radio', { name: 'Sans-serif' }))
    await userEvent.click(screen.getByRole('radio', { name: /Nuit douce/ }))

    const shell = container.querySelector<HTMLElement>('.reader-shell')
    expect(shell).toHaveAttribute('data-reader-font', 'sans')
    expect(shell).toHaveAttribute('data-reader-paper', 'softDark')
    expect(shell?.style.getPropertyValue('--reading-font-size')).toBe('20px')
    expect(shell?.style.getPropertyValue('--reading-line-height')).toBe('1.9')
    expect(JSON.parse(localStorage.getItem('ln-reader-reading-preferences') ?? '')).toMatchObject({
      fontSize: 20,
      lineHeight: 1.9,
      fontFamily: 'sans',
      paper: 'softDark',
    })
    await waitFor(() => expect(window.scrollTo).toHaveBeenCalled())

    await userEvent.click(screen.getByRole('button', { name: 'Terminé' }))
    expect(screen.queryByRole('dialog', { name: 'Apparence du texte' })).not.toBeInTheDocument()

    unmount()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
})
