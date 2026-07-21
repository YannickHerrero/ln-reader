import { MemoryRouter } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/app/App'
import { db } from '../src/db/database'

const response = (value: unknown) => Promise.resolve(new Response(JSON.stringify(value), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
}))

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('library page', () => {
  it('searches for and adds a text series to the local library', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = input.toString()
      if (url.includes('/api/source/discover')) {
        return response({ popular: [], recentlyAdded: [], recentlyUpdated: [] })
      }
      if (url.includes('/api/source/search')) {
        return response([{ key: '/oeuvre/toradora/', title: 'Toradora!', sourceType: 'text' }])
      }
      if (url.includes('/api/source/series')) {
        return response({
          key: '/oeuvre/toradora/',
          title: 'Toradora!',
          coverImage: null,
          author: 'Yuyuko Takemiya',
          description: 'Synopsis',
          genres: ['Novel', 'Romance'],
          status: 'En cours',
          chapters: [{ key: '/oeuvre/toradora/chapitre-1/', title: 'Chapitre 1', number: 1, publishedAt: null }],
        })
      }
      throw new Error(`Unexpected request: ${url}`)
    }))

    const { unmount } = render(<MemoryRouter><App /></MemoryRouter>)
    await userEvent.click(screen.getByRole('link', { name: 'Rechercher un titre' }))
    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher un titre' }), 'toradora')

    expect(await screen.findByText('Toradora!')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '+ Ajouter' }))

    await waitFor(() => expect(screen.getByText(/a été ajouté/)).toBeInTheDocument())
    expect(await db.series.get('/oeuvre/toradora/')).toMatchObject({ title: 'Toradora!' })
    await userEvent.click(screen.getByRole('link', { name: '← Bibliothèque' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Toradora!' })).toBeInTheDocument())
    unmount()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
})
