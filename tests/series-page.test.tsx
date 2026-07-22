import { MemoryRouter } from 'react-router-dom'
import { render, screen, waitFor, within } from '@testing-library/react'
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
  sources: [{ source: 'novelFr', key: '/oeuvre/example/' }],
  coverImage: null,
  author: 'Jane Doe',
  description: 'A readable synopsis.',
  genres: ['Novel', 'Fantasy'],
  status: 'En cours',
  chapters: [
    {
      key: '/oeuvre/example/chapitre-2/',
      title: 'Chapitre 2',
      number: 2,
      volume: null,
      publishedAt: '13 mars 2024',
      releases: [{ source: 'novelFr', key: '/oeuvre/example/chapitre-2/' }],
    },
    {
      key: '/oeuvre/example/chapitre-1/',
      title: 'Chapitre 1',
      number: 1,
      volume: null,
      publishedAt: '12 mars 2024',
      releases: [{ source: 'novelFr', key: '/oeuvre/example/chapitre-1/' }],
    },
  ],
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
      key: series.chapters[1]!.key,
      title: 'Chapitre 1',
      html: '<p>Contenu hors ligne.</p>',
      source: 'novelFr',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))))

    const route = `/series/${encodeRouteKey(series.key)}`
    const { container, unmount } = render(<MemoryRouter initialEntries={[route]}><App /></MemoryRouter>)

    expect(await screen.findByRole('heading', { name: 'Example Novel' })).toBeInTheDocument()
    const chapterTitles = () => [...container.querySelectorAll('.chapter-row strong')].map((element) => element.textContent)
    expect(chapterTitles()).toEqual(['Chapitre 2', 'Chapitre 1'])
    await userEvent.click(screen.getByRole('button', { name: 'Trier les chapitres du premier au dernier' }))
    await waitFor(() => expect(chapterTitles()).toEqual(['Chapitre 1', 'Chapitre 2']))
    expect(localStorage.getItem('chapter-order')).toBe('ascending')
    await userEvent.click(screen.getByRole('button', { name: 'Télécharger Chapitre 1' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Supprimer le téléchargement de Chapitre 1' })).toBeInTheDocument())
    expect(await libraryRepository.getDownload(series.chapters[1]!.key)).toMatchObject({ html: '<p>Contenu hors ligne.</p>' })

    await userEvent.click(screen.getByRole('button', { name: 'Supprimer le téléchargement de Chapitre 1' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Télécharger Chapitre 1' })).toBeInTheDocument())
    expect(await libraryRepository.getDownload(series.chapters[1]!.key)).toBeUndefined()

    unmount()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  it('groups chapters by volume and hides fully read volumes', async () => {
    const volumeSeries: SourceSeries = {
      ...series,
      key: 'novelFr:/series/volume-example/',
      sources: [{ source: 'novelFr', key: 'novelFr:/series/volume-example/' }],
      chapters: [
        { key: 'novelFr:/v2-c2/', title: 'Volume 2 · Chapitre 2', number: 2, volume: 2, publishedAt: null, releases: [{ source: 'novelFr', key: 'novelFr:/v2-c2/' }] },
        { key: 'novelFr:/v2-c1/', title: 'Volume 2 · Chapitre 1', number: 1, volume: 2, publishedAt: null, releases: [{ source: 'novelFr', key: 'novelFr:/v2-c1/' }] },
        { key: 'novelFr:/v1-c2/', title: 'Volume 1 · Chapitre 2', number: 2, volume: 1, publishedAt: null, releases: [{ source: 'novelFr', key: 'novelFr:/v1-c2/' }] },
        { key: 'novelFr:/v1-c1/', title: 'Volume 1 · Chapitre 1', number: 1, volume: 1, publishedAt: null, releases: [{ source: 'novelFr', key: 'novelFr:/v1-c1/' }] },
      ],
    }
    await libraryRepository.addOrUpdateSeries(volumeSeries)
    await libraryRepository.saveProgress(volumeSeries.key, 'novelFr:/v2-c2/', 1, true)
    await libraryRepository.saveProgress(volumeSeries.key, 'novelFr:/v2-c1/', 1, true)
    await libraryRepository.saveProgress(volumeSeries.key, 'novelFr:/v1-c1/', 1, true)

    const route = `/series/${encodeRouteKey(volumeSeries.key)}`
    const { unmount } = render(<MemoryRouter initialEntries={[route]}><App /></MemoryRouter>)

    let volumes = within(await screen.findByRole('group', { name: 'Volumes' }))
    expect(volumes.getByRole('button', { name: /Volume 2/ })).toBeInTheDocument()
    expect(volumes.getByRole('button', { name: /Volume 1/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Masquer les chapitres lus' }))

    await waitFor(() => expect(within(screen.getByRole('group', { name: 'Volumes' })).queryByRole('button', { name: /Volume 2/ })).not.toBeInTheDocument())
    volumes = within(screen.getByRole('group', { name: 'Volumes' }))
    expect(volumes.getByRole('button', { name: /Volume 1/ })).toBeInTheDocument()
    expect(screen.getByText('Volume 1 · Chapitre 2')).toBeInTheDocument()
    expect(screen.queryByText('Volume 1 · Chapitre 1')).not.toBeInTheDocument()

    unmount()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
})
