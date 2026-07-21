import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/app/App'
import { db } from '../src/db/database'

const jsonResponse = (value: unknown) => Promise.resolve(new Response(JSON.stringify(value), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
}))

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('search page', () => {
  it('shows discovery sections while the query is empty', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = input.toString()
      if (url.includes('/api/source/discover')) {
        return jsonResponse({
          popular: [{ key: '/oeuvre/popular/', title: 'Popular Novel', coverImage: null }],
          recentlyAdded: [{ key: '/oeuvre/new/', title: 'New Novel', coverImage: null }],
          recentlyUpdated: [{ key: '/oeuvre/updated/', title: 'Updated Novel', coverImage: null }],
        })
      }
      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const { unmount } = render(<MemoryRouter initialEntries={['/search']}><App /></MemoryRouter>)

    expect(await screen.findByRole('heading', { name: 'Les plus populaires' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ajoutés récemment' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mis à jour récemment' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Popular Novel' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'New Novel' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Updated Novel' })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    unmount()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
})
