import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { sourceApi } from '../api/source'
import { decodeRouteKey, encodeRouteKey } from '../app/route-key'
import { CoverArt } from '../components/CoverArt'
import { ThemeToggle } from '../components/ThemeToggle'
import type { ChapterRecord, ReadingProgressRecord } from '../db/database'
import { libraryRepository } from '../db/repository'
import { sourceName, sourcesLabel } from '../source/labels'

const EMPTY_KEYS = new Set<string>()

function readerPath(seriesKey: string, chapterKey: string) {
  return `/read/${encodeRouteKey(seriesKey)}/${encodeRouteKey(chapterKey)}`
}

export function SeriesPage() {
  const { seriesId = '' } = useParams()
  const seriesKey = decodeRouteKey(seriesId)
  const series = useLiveQuery(
    async () => seriesKey ? (await libraryRepository.getSeries(seriesKey)) ?? null : null,
    [seriesKey],
  )
  const chapters = useLiveQuery(
    async () => seriesKey ? await libraryRepository.getChapters(seriesKey) : [] as ChapterRecord[],
    [seriesKey],
    [] as ChapterRecord[],
  )
  const progressEntries = useLiveQuery(
    async () => seriesKey ? await libraryRepository.getSeriesProgressEntries(seriesKey) : [] as ReadingProgressRecord[],
    [seriesKey],
    [] as ReadingProgressRecord[],
  )
  const downloadedKeys = useLiveQuery(
    async () => seriesKey ? await libraryRepository.downloadedChapterKeys(seriesKey) : EMPTY_KEYS,
    [seriesKey],
    EMPTY_KEYS,
  )
  const [busyChapter, setBusyChapter] = useState<string | null>(null)
  const [chapterOrder, setChapterOrder] = useState<'descending' | 'ascending'>(() =>
    localStorage.getItem('chapter-order') === 'ascending' ? 'ascending' : 'descending',
  )
  const [refreshing, setRefreshing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const progress = useMemo(
    () => new Map(progressEntries.map((entry) => [entry.chapterKey, entry])),
    [progressEntries],
  )
  const current = [...progressEntries].sort((left, right) => right.lastReadAt - left.lastReadAt)[0]
  const displayedChapters = useMemo(
    () => chapterOrder === 'ascending' ? [...chapters].reverse() : chapters,
    [chapterOrder, chapters],
  )
  const startChapter = current
    ? chapters.find((chapter) => chapter.key === current.chapterKey)
    : chapters.at(-1)

  useEffect(() => {
    if (series) document.title = `${series.title} · LN Reader`
    return () => { document.title = 'LN Reader' }
  }, [series])

  useEffect(() => {
    localStorage.setItem('chapter-order', chapterOrder)
  }, [chapterOrder])

  if (series === undefined) return <main className="center-state">Chargement…</main>
  if (!seriesKey || series === null) return <Navigate to="/" replace />

  async function refresh() {
    if (!seriesKey) return
    setRefreshing(true)
    setMessage(null)
    try {
      const updated = await sourceApi.series(seriesKey)
      const storedCover = await libraryRepository.getCover(seriesKey)
      let cover: Blob | undefined
      if (!storedCover && updated.coverImage) {
        try { cover = await sourceApi.cover(updated.coverImage) } catch { /* Metadata still refreshes. */ }
      }
      await libraryRepository.addOrUpdateSeries(updated, cover)
      setMessage('Liste des chapitres actualisée.')
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "L'actualisation a échoué.")
    } finally {
      setRefreshing(false)
    }
  }

  async function toggleDownload(chapterKey: string) {
    if (!seriesKey) return
    setBusyChapter(chapterKey)
    setMessage(null)
    try {
      if (downloadedKeys.has(chapterKey)) {
        await libraryRepository.removeDownload(chapterKey)
      } else {
        const chapter = await libraryRepository.getChapter(chapterKey)
        if (!chapter) throw new Error('Ce chapitre est introuvable.')
        const content = await sourceApi.chapter(chapterKey, chapter.releases)
        await libraryRepository.downloadChapter(seriesKey, content)
      }
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Le téléchargement a échoué.')
    } finally {
      setBusyChapter(null)
    }
  }

  return (
    <main className="detail-shell">
      <nav className="detail-nav">
        <Link to="/" className="back-link">← Bibliothèque</Link>
        <strong className="detail-nav__title">{series.title}</strong>
        <div className="detail-nav__actions">
          <ThemeToggle />
          <div className="sort-control" aria-label="Ordre des chapitres">
            <button
              type="button"
              aria-label="Trier les chapitres du premier au dernier"
              aria-pressed={chapterOrder === 'ascending'}
              onClick={() => setChapterOrder('ascending')}
            >1→N</button>
            <button
              type="button"
              aria-label="Trier les chapitres du dernier au premier"
              aria-pressed={chapterOrder === 'descending'}
              onClick={() => setChapterOrder('descending')}
            >N→1</button>
          </div>
          <button className="text-button refresh-button" type="button" onClick={refresh} disabled={refreshing} aria-label="Actualiser la série">
            <span aria-hidden="true">{refreshing ? '…' : '↻'}</span><span>{refreshing ? 'Actualisation…' : 'Actualiser'}</span>
          </button>
        </div>
      </nav>

      <section className="series-hero">
        <CoverArt seriesKey={series.key} title={series.title} className="series-hero__backdrop" decorative />
        <div className="series-hero__shade" />
        <CoverArt seriesKey={series.key} title={series.title} className="series-cover" />
        <div className="series-hero__copy">
          <p className="eyebrow">{series.status ?? 'Roman'}</p>
          <h1>{series.title}</h1>
          {series.author && <p className="series-author">par {series.author}</p>}
          <div className="source-list" aria-label="Sources disponibles">
            {series.sources.map((source) => <span key={`${source.source}:${source.key}`}>{sourceName(source.source)}</span>)}
          </div>
          <div className="genre-list">{series.genres.map((genre) => <span key={genre}>{genre}</span>)}</div>
          {series.description && <p className="series-description">{series.description}</p>}
          {startChapter && (
            <Link className="read-button" to={readerPath(series.key, startChapter.key)}>
              <span aria-hidden="true">▶</span>
              <span>{current ? 'Continuer' : 'Commencer'}</span>
              <span className="read-button__chapter">· {startChapter.title}</span>
            </Link>
          )}
        </div>
      </section>

      <section className="chapters-section" aria-labelledby="chapters-title">
        <div className="section-heading">
          <h2 id="chapters-title">Chapitres</h2>
          <span>{chapters.length} disponibles</span>
        </div>
        {message && <p className="message" role="status">{message}</p>}
        {chapters.length === 0 ? (
          <p className="chapter-empty">Aucun chapitre disponible pour le moment.</p>
        ) : (
          <div className="chapter-list">
            {displayedChapters.map((chapter) => {
              const chapterProgress = progress.get(chapter.key)
              const downloaded = downloadedKeys.has(chapter.key)
              return (
                <article className={`chapter-row ${chapterProgress?.completed ? 'chapter-row--read' : ''}`} key={chapter.key}>
                  <Link to={readerPath(series.key, chapter.key)} className="chapter-row__link">
                    <span className="chapter-status" aria-hidden="true">{chapterProgress?.completed ? '✓' : '○'}</span>
                    <span>
                      <strong>{chapter.title}</strong>
                      <small className="chapter-meta">
                        {chapter.publishedAt && <span>{chapter.publishedAt}</span>}
                        <span title={chapter.releases.map((release) => sourceName(release.source)).join(', ')}>{sourcesLabel(chapter.releases)}</span>
                      </small>
                    </span>
                  </Link>
                  <button
                    className={`download-button ${downloaded ? 'download-button--active' : ''}`}
                    type="button"
                    disabled={busyChapter === chapter.key}
                    onClick={() => toggleDownload(chapter.key)}
                    aria-label={downloaded ? `Supprimer le téléchargement de ${chapter.title}` : `Télécharger ${chapter.title}`}
                    title={downloaded ? 'Supprimer le téléchargement' : 'Télécharger pour lire hors ligne'}
                  >
                    {busyChapter === chapter.key ? '…' : downloaded ? '✓' : '↓'}
                  </button>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
