import { MemoryRouter } from 'react-router-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  author: null,
  description: null,
  genres: ['Novel'],
  status: null,
  chapters: [
    { key: '/oeuvre/example/chapitre-2/', title: 'Chapitre 2', number: 2, volume: null, publishedAt: null, releases: [{ source: 'novelFr', key: '/oeuvre/example/chapitre-2/' }] },
    { key: '/oeuvre/example/chapitre-1/', title: 'Chapitre 1', number: 1, volume: null, publishedAt: null, releases: [{ source: 'novelFr', key: '/oeuvre/example/chapitre-1/' }] },
  ],
}

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()))
  await libraryRepository.addOrUpdateSeries(series)
  await libraryRepository.downloadChapter(series.key, {
    key: series.chapters[1]!.key,
    title: 'Chapitre 1',
    html: '<p>Contenu téléchargé.</p>',
    source: 'novelFr',
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

  it('keeps chapter navigation inside the current volume', async () => {
    const volumeSeries: SourceSeries = {
      ...series,
      key: 'novelFr:/series/volume-reader/',
      sources: [{ source: 'novelFr', key: 'novelFr:/series/volume-reader/' }],
      chapters: [
        { key: 'novelFr:/v2-c1/', title: 'Volume 2 · Chapitre 1', number: 1, volume: 2, publishedAt: null, releases: [{ source: 'novelFr', key: 'novelFr:/v2-c1/' }] },
        { key: 'novelFr:/v1-c2/', title: 'Volume 1 · Chapitre 2', number: 2, volume: 1, publishedAt: null, releases: [{ source: 'novelFr', key: 'novelFr:/v1-c2/' }] },
        { key: 'novelFr:/v1-c1/', title: 'Volume 1 · Chapitre 1', number: 1, volume: 1, publishedAt: null, releases: [{ source: 'novelFr', key: 'novelFr:/v1-c1/' }] },
      ],
    }
    await libraryRepository.addOrUpdateSeries(volumeSeries)
    await libraryRepository.downloadChapter(volumeSeries.key, {
      key: 'novelFr:/v1-c1/',
      title: 'Volume 1 · Chapitre 1',
      html: '<p>Premier chapitre du volume.</p>',
      source: 'novelFr',
    })
    vi.stubGlobal('fetch', vi.fn())

    const route = `/read/${encodeRouteKey(volumeSeries.key)}/${encodeRouteKey('novelFr:/v1-c1/')}`
    const { unmount } = render(<MemoryRouter initialEntries={[route]}><App /></MemoryRouter>)

    expect(await screen.findByText('Premier chapitre du volume.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Volume 1 · Chapitre 2/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Volume 2 · Chapitre 1/ })).not.toBeInTheDocument()

    unmount()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  it('reads one paragraph at a time and saves focused progress', async () => {
    await libraryRepository.downloadChapter(series.key, {
      key: series.chapters[1]!.key,
      title: 'Chapitre 1',
      html: '<p>Premier paragraphe. Avec deux phrases.</p><p>Deuxième paragraphe.</p>',
      source: 'novelFr',
    })
    vi.stubGlobal('fetch', vi.fn())
    const route = `/read/${encodeRouteKey(series.key)}/${encodeRouteKey(series.chapters[1]!.key)}`
    const { container, unmount } = render(<MemoryRouter initialEntries={[route]}><App /></MemoryRouter>)

    expect(await screen.findByText('Premier paragraphe. Avec deux phrases.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Options de lecture' }))
    await userEvent.click(screen.getByRole('radio', { name: /Paragraphe/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Terminé' }))

    expect(screen.getByRole('region', { name: 'Lecture par paragraphe' })).toBeInTheDocument()
    expect(document.documentElement).toHaveClass('reader-focus-locked')
    expect(document.body).toHaveClass('reader-focus-locked')
    expect(screen.getByText('Paragraphe 1 sur 2')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Paragraphe suivant' }))
    expect(screen.getByText('Deuxième paragraphe.')).toBeInTheDocument()
    expect(screen.getByText('Paragraphe 2 sur 2')).toBeInTheDocument()
    await waitFor(async () => expect(await libraryRepository.getChapterProgress(series.chapters[1]!.key)).toMatchObject({
      scrollRatio: 1,
      completed: true,
    }))

    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(390)
    const shell = container.querySelector<HTMLElement>('.reader-shell')!
    const stage = container.querySelector<HTMLElement>('.reader-focus__stage')!
    const header = container.querySelector<HTMLElement>('.reader-bar')!
    const controls = container.querySelector<HTMLElement>('.reader-focus__controls')!
    const controlCount = controls.querySelectorAll('button, a, input').length
    const dispatchPointer = (type: 'pointerdown' | 'pointerup') => {
      const event = new Event(type, { bubbles: true })
      Object.defineProperties(event, {
        pointerId: { value: 1 },
        isPrimary: { value: true },
        pointerType: { value: 'touch' },
        button: { value: 0 },
        clientX: { value: 195 },
        clientY: { value: 300 },
      })
      fireEvent(stage, event)
    }
    const tapCenter = () => {
      dispatchPointer('pointerdown')
      dispatchPointer('pointerup')
    }

    tapCenter()
    expect(shell).toHaveAttribute('data-reader-controls', 'hidden')
    expect(header).toHaveAttribute('aria-hidden', 'true')
    expect(header).toHaveAttribute('inert')
    expect(controls).toHaveAttribute('aria-hidden', 'true')
    expect(controls).toHaveAttribute('inert')
    expect(controls.querySelectorAll('button, a, input')).toHaveLength(controlCount)

    tapCenter()
    expect(shell).toHaveAttribute('data-reader-controls', 'visible')
    expect(header).toHaveAttribute('aria-hidden', 'false')
    expect(controls).toHaveAttribute('aria-hidden', 'false')

    unmount()
    expect(document.documentElement).not.toHaveClass('reader-focus-locked')
    expect(document.body).not.toHaveClass('reader-focus-locked')
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  it('seeks directly through focused pages with the progress control', async () => {
    await libraryRepository.downloadChapter(series.key, {
      key: series.chapters[1]!.key,
      title: 'Chapitre 1',
      html: '<p>Première phrase. Deuxième phrase. Troisième phrase. Quatrième phrase.</p>',
      source: 'novelFr',
    })
    localStorage.setItem('ln-reader-reading-preferences', JSON.stringify({ mode: 'sentence' }))
    vi.stubGlobal('fetch', vi.fn())
    const route = `/read/${encodeRouteKey(series.key)}/${encodeRouteKey(series.chapters[1]!.key)}`
    const { unmount } = render(<MemoryRouter initialEntries={[route]}><App /></MemoryRouter>)

    expect(await screen.findByText('Première phrase.')).toBeInTheDocument()
    const progressControl = screen.getByRole('slider', { name: 'Aller à une phrase' })
    expect(progressControl).toHaveValue('0')
    expect(progressControl).toHaveAttribute('max', '3')

    fireEvent.change(progressControl, { target: { value: '2' } })
    expect(screen.getByText('Troisième phrase.')).toBeInTheDocument()
    expect(screen.getByText('Phrase 3 sur 4')).toBeInTheDocument()
    await waitFor(async () => expect((await libraryRepository.getChapterProgress(series.chapters[1]!.key))?.scrollRatio).toBeCloseTo(2 / 3))

    fireEvent.change(progressControl, { target: { value: '0' } })
    expect(screen.getByText('Première phrase.')).toBeInTheDocument()
    expect(screen.getByText('Phrase 1 sur 4')).toBeInTheDocument()
    await waitFor(async () => expect(await libraryRepository.getChapterProgress(series.chapters[1]!.key)).toMatchObject({ scrollRatio: 0 }))

    unmount()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  it('navigates sentence mode with the keyboard', async () => {
    await libraryRepository.downloadChapter(series.key, {
      key: series.chapters[1]!.key,
      title: 'Chapitre 1',
      html: '<p>Première phrase. Deuxième phrase.</p><p>Dernière phrase.</p>',
      source: 'novelFr',
    })
    await libraryRepository.downloadChapter(series.key, {
      key: series.chapters[0]!.key,
      title: 'Chapitre 2',
      html: '<p>Début du chapitre suivant. Suite du chapitre suivant.</p>',
      source: 'novelFr',
    })
    localStorage.setItem('ln-reader-reading-preferences', JSON.stringify({ mode: 'sentence' }))
    vi.stubGlobal('fetch', vi.fn())
    const route = `/read/${encodeRouteKey(series.key)}/${encodeRouteKey(series.chapters[1]!.key)}`
    const { unmount } = render(<MemoryRouter initialEntries={[route]}><App /></MemoryRouter>)

    expect(await screen.findByText('Première phrase.')).toBeInTheDocument()
    expect(screen.getByText('Phrase 1 sur 3')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: ' ' })
    expect(screen.getByText('Deuxième phrase.')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'End' })
    expect(screen.getByText('Dernière phrase.')).toBeInTheDocument()
    expect(screen.getByText('Phrase 3 sur 3')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: 'Lire Chapitre 2' }))
    expect(await screen.findByText('Début du chapitre suivant.')).toBeInTheDocument()
    expect(screen.getByText('Phrase 1 sur 2')).toBeInTheDocument()

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
