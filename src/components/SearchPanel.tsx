import { useEffect, useRef, useState, type FormEvent } from 'react'
import { sourceApi } from '../api/source'
import { libraryRepository } from '../db/repository'
import type { SourceSearchResult } from '../../shared/contracts'

interface SearchPanelProps {
  onClose(): void
  onAdded(seriesKey: string): void
}

export function SearchPanel({ onClose, onAdded }: SearchPanelProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SourceSearchResult[]>([])
  const [status, setStatus] = useState<'idle' | 'searching' | 'adding'>('idle')
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    libraryRepository.listSeries().then((series) => {
      setAddedKeys(new Set(series.map((item) => item.key)))
    })
  }, [])

  async function search(event: FormEvent) {
    event.preventDefault()
    const trimmed = query.trim()
    if (trimmed.length < 2) return
    setStatus('searching')
    setHasSearched(true)
    setError(null)
    try {
      setResults(await sourceApi.search(trimmed))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'La recherche a échoué.')
    } finally {
      setStatus('idle')
    }
  }

  async function add(result: SourceSearchResult) {
    setStatus('adding')
    setError(null)
    try {
      const series = await sourceApi.series(result.key)
      let cover: Blob | undefined
      if (series.coverImage) {
        try {
          cover = await sourceApi.cover(series.coverImage)
        } catch {
          // A missing cover should not prevent adding a readable series.
        }
      }
      await libraryRepository.addOrUpdateSeries(series, cover)
      setAddedKeys((current) => new Set(current).add(result.key))
      onAdded(result.key)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible d'ajouter cette série.")
    } finally {
      setStatus('idle')
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="search-panel" role="dialog" aria-modal="true" aria-labelledby="search-title">
        <header className="search-panel__header">
          <div>
            <p className="eyebrow">Mangas-Origines</p>
            <h2 id="search-title">Ajouter une série</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Fermer">×</button>
        </header>

        <form className="search-form" onSubmit={search}>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setHasSearched(false)
            }}
            minLength={2}
            maxLength={100}
            placeholder="Rechercher un light novel…"
            aria-label="Titre"
          />
          <button type="submit" disabled={status !== 'idle' || query.trim().length < 2}>
            {status === 'searching' ? 'Recherche…' : 'Rechercher'}
          </button>
        </form>

        {error && <p className="message message--error" role="alert">{error}</p>}
        {results.length === 0 && status === 'idle' && hasSearched && !error && (
          <p className="message">Aucun roman trouvé. Essayez le titre original.</p>
        )}
        <div className="search-results">
          {results.map((result) => {
            const added = addedKeys.has(result.key)
            return (
              <article className="search-result" key={result.key}>
                <span className="search-result__mark" aria-hidden="true">文</span>
                <div><h3>{result.title}</h3><p>Roman · Français</p></div>
                <button type="button" disabled={added || status !== 'idle'} onClick={() => add(result)}>
                  {added ? 'Ajouté' : 'Ajouter'}
                </button>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}
