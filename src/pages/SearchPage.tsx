import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ThemeToggle } from '../components/ThemeToggle'
import type {
  SourceBrowseResult,
  SourceDiscovery,
  SourceSearchResult,
} from '../../shared/contracts'
import { sourceApi } from '../api/source'
import { libraryRepository } from '../db/repository'
import { sourcesLabel } from '../source/labels'
import { normalizeSeriesTitle } from '../source/normalize-title'

interface AddableSeries {
  key: string
  title: string
}

function sourceCoverUrl(url: string) {
  return `/api/source/asset?url=${encodeURIComponent(url)}`
}

function DiscoveryCard({
  item,
  rank,
  added,
  busy,
  onAdd,
}: {
  item: SourceBrowseResult
  rank?: number
  added: boolean
  busy: boolean
  onAdd(): void
}) {
  return (
    <article className="discovery-card">
      <div className="discovery-cover">
        {item.coverImage
          ? <img src={sourceCoverUrl(item.coverImage)} alt={`Couverture de ${item.title}`} loading={rank && rank <= 3 ? 'eager' : 'lazy'} />
          : <span aria-hidden="true">{item.title.slice(0, 1)}</span>}
        {rank && <strong className="discovery-rank" aria-label={`Numéro ${rank}`}>{String(rank).padStart(2, '0')}</strong>}
      </div>
      <div className="discovery-card__copy">
        <p>{sourcesLabel(item.sources)} · Français</p>
        <h3>{item.title}</h3>
        <button type="button" disabled={added || busy} onClick={onAdd}>
          {busy ? 'Ajout…' : added ? 'Ajouté' : '+ Ajouter'}
        </button>
      </div>
    </article>
  )
}

function DiscoverySection({
  id,
  title,
  description,
  items,
  ranked = false,
  addedTitles,
  busyKey,
  onAdd,
}: {
  id: string
  title: string
  description: string
  items: SourceBrowseResult[]
  ranked?: boolean
  addedTitles: Set<string>
  busyKey: string | null
  onAdd(item: AddableSeries): void
}) {
  return (
    <section className="discovery-section" aria-labelledby={id}>
      <header>
        <div><p className="eyebrow">Sélection</p><h2 id={id}>{title}</h2></div>
        <p>{description}</p>
      </header>
      <div className="discovery-row">
        {items.map((item, index) => (
          <DiscoveryCard
            key={item.key}
            item={item}
            rank={ranked ? index + 1 : undefined}
            added={addedTitles.has(normalizeSeriesTitle(item.title))}
            busy={busyKey === item.key}
            onAdd={() => onAdd(item)}
          />
        ))}
      </div>
    </section>
  )
}

export function SearchPage() {
  const library = useLiveQuery(() => libraryRepository.listSeries(), [], [])
  const existingByTitle = useMemo(
    () => new Map(library.map((item) => [normalizeSeriesTitle(item.title), item])),
    [library],
  )
  const addedTitles = useMemo(() => new Set(existingByTitle.keys()), [existingByTitle])
  const [query, setQuery] = useState('')
  const [discovery, setDiscovery] = useState<SourceDiscovery | null>(null)
  const [results, setResults] = useState<SourceSearchResult[]>([])
  const [discoveryLoading, setDiscoveryLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    document.title = 'Découvrir · LN Reader'
    inputRef.current?.focus()
    const controller = new AbortController()
    sourceApi.discover(controller.signal)
      .then(setDiscovery)
      .catch((caught) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        setError(caught instanceof Error ? caught.message : 'Les sélections sont indisponibles.')
      })
      .finally(() => setDiscoveryLoading(false))
    return () => {
      controller.abort()
      document.title = 'LN Reader'
    }
  }, [])

  useEffect(() => {
    const trimmed = query.trim()
    setNotice(null)
    if (!trimmed) {
      setResults([])
      setHasSearched(false)
      setSearching(false)
      setError(null)
      return
    }
    if (trimmed.length < 2) {
      setResults([])
      setHasSearched(false)
      setSearching(false)
      return
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => {
      setSearching(true)
      setError(null)
      sourceApi.search(trimmed, controller.signal)
        .then((items) => {
          setResults(items)
          setHasSearched(true)
        })
        .catch((caught) => {
          if (caught instanceof DOMException && caught.name === 'AbortError') return
          setError(caught instanceof Error ? caught.message : 'La recherche a échoué.')
          setHasSearched(true)
        })
        .finally(() => setSearching(false))
    }, 350)

    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [query])

  async function add(item: AddableSeries) {
    setBusyKey(item.key)
    setError(null)
    setNotice(null)
    try {
      const existing = existingByTitle.get(normalizeSeriesTitle(item.title))
      const series = await sourceApi.series(existing?.key ?? item.key)
      let cover: Blob | undefined
      if (series.coverImage) {
        try { cover = await sourceApi.cover(series.coverImage) } catch { /* A cover is optional. */ }
      }
      await libraryRepository.addOrUpdateSeries(series, cover)
      setNotice(`« ${series.title} » a été ajouté à votre bibliothèque.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible d'ajouter cette série.")
    } finally {
      setBusyKey(null)
    }
  }

  const showingSearch = query.trim().length > 0

  return (
    <main className="search-page">
      <header className="search-page__nav">
        <Link to="/" className="back-link">← Bibliothèque</Link>
        <a className="wordmark" href="/" aria-label="LN Reader, accueil"><span>LN</span> Reader</a>
        <div className="search-page__actions"><ThemeToggle /></div>
      </header>

      <section className="search-page__intro">
        <p className="eyebrow">Novel-FR · Mangas-Origines</p>
        <h1>Votre prochaine<br /><em>histoire.</em></h1>
        <div className="search-page__field">
          <span aria-hidden="true">⌕</span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un light novel…"
            aria-label="Rechercher un titre"
            maxLength={100}
          />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Effacer la recherche">×</button>}
        </div>
      </section>

      {error && <p className="search-page__message search-page__message--error" role="alert">{error}</p>}
      {notice && <p className="search-page__message" role="status">{notice}</p>}

      {showingSearch ? (
        <section className="search-list-section" aria-labelledby="search-results-title">
          <div className="section-heading">
            <h2 id="search-results-title">Résultats</h2>
            <span>{searching ? 'Recherche…' : `${results.length} trouvé${results.length > 1 ? 's' : ''}`}</span>
          </div>
          {!searching && hasSearched && results.length === 0 && !error && (
            <p className="chapter-empty">Aucun roman trouvé. Essayez le titre original.</p>
          )}
          <div className="search-page__results">
            {results.map((result) => {
              const added = addedTitles.has(normalizeSeriesTitle(result.title))
              return (
                <article className="search-page__result" key={result.key}>
                  <span aria-hidden="true">文</span>
                  <div><p>{sourcesLabel(result.sources)} · Français</p><h3>{result.title}</h3></div>
                  <button type="button" disabled={added || busyKey === result.key} onClick={() => add(result)}>
                    {busyKey === result.key ? 'Ajout…' : added ? 'Ajouté' : '+ Ajouter'}
                  </button>
                </article>
              )
            })}
          </div>
        </section>
      ) : discoveryLoading ? (
        <section className="discovery-loading"><span className="reader-pulse" />Préparation des sélections…</section>
      ) : discovery && (
        <div className="discovery-sections">
          <DiscoverySection
            id="popular-title"
            title="Les plus populaires"
            description="Les romans les plus lus par la communauté."
            items={discovery.popular}
            ranked
            addedTitles={addedTitles}
            busyKey={busyKey}
            onAdd={add}
          />
          <DiscoverySection
            id="recently-added-title"
            title="Ajoutés récemment"
            description="Les derniers romans arrivés au catalogue."
            items={discovery.recentlyAdded}
            addedTitles={addedTitles}
            busyKey={busyKey}
            onAdd={add}
          />
          <DiscoverySection
            id="recently-updated-title"
            title="Mis à jour récemment"
            description="Des histoires qui viennent de recevoir un chapitre."
            items={discovery.recentlyUpdated}
            addedTitles={addedTitles}
            busyKey={busyKey}
            onAdd={add}
          />
        </div>
      )}
    </main>
  )
}
