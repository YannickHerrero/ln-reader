import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SourceSeries } from '../shared/contracts'
import { App } from '../src/app/App'
import { encodeRouteKey } from '../src/app/route-key'
import { db } from '../src/db/database'
import { libraryRepository } from '../src/db/repository'

const series: SourceSeries = {
  key: '/oeuvre/example/',
  title: 'Example Novel',
  coverImage: null,
  author: null,
  description: null,
  genres: ['Novel'],
  status: null,
  chapters: [
    { key: '/oeuvre/example/chapitre-2/', title: 'Chapitre 2', number: 2, publishedAt: null },
    { key: '/oeuvre/example/chapitre-1/', title: 'Chapitre 1', number: 1, publishedAt: null },
  ],
}

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()))
  await libraryRepository.addOrUpdateSeries(series)
  await libraryRepository.downloadChapter(series.key, {
    key: series.chapters[1]!.key,
    title: 'Chapitre 1',
    html: '<p>Contenu téléchargé.</p>',
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
    expect(screen.getByText('Disponible hors ligne')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Chapitre 2/ })).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()

    unmount()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
})
