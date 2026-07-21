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
  coverImage: null,
  author: 'Jane Doe',
  description: 'A readable synopsis.',
  genres: ['Novel', 'Fantasy'],
  status: 'En cours',
  chapters: [{
    key: '/oeuvre/example/chapitre-1/',
    title: 'Chapitre 1',
    number: 1,
    publishedAt: '12 mars 2024',
  }],
}

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()))
  await libraryRepository.addOrUpdateSeries(series)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('series page', () => {
  it('downloads and removes an individual chapter', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({
      key: series.chapters[0]!.key,
      title: 'Chapitre 1',
      html: '<p>Contenu hors ligne.</p>',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))))

    const route = `/series/${encodeRouteKey(series.key)}`
    const { unmount } = render(<MemoryRouter initialEntries={[route]}><App /></MemoryRouter>)

    expect(await screen.findByRole('heading', { name: 'Example Novel' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Télécharger Chapitre 1' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Supprimer le téléchargement de Chapitre 1' })).toBeInTheDocument())
    expect(await libraryRepository.getDownload(series.chapters[0]!.key)).toMatchObject({ html: '<p>Contenu hors ligne.</p>' })

    await userEvent.click(screen.getByRole('button', { name: 'Supprimer le téléchargement de Chapitre 1' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Télécharger Chapitre 1' })).toBeInTheDocument())
    expect(await libraryRepository.getDownload(series.chapters[0]!.key)).toBeUndefined()

    unmount()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
})
