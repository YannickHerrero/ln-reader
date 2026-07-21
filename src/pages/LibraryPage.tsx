import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CoverArt } from '../components/CoverArt'
import type { LibrarySeriesRecord } from '../db/database'
import { libraryRepository } from '../db/repository'
import { encodeRouteKey } from '../app/route-key'

function LibraryCard({ series }: { series: LibrarySeriesRecord }) {
  const progress = useLiveQuery(() => libraryRepository.getSeriesProgress(series.key), [series.key])
  const currentChapter = useLiveQuery(
    async () => progress?.current
      ? await libraryRepository.getChapter(progress.current.chapterKey)
      : undefined,
    [progress?.current?.chapterKey],
  )
  const percent = progress?.chapterCount
    ? Math.round((progress.completedCount / progress.chapterCount) * 100)
    : 0

  async function remove() {
    if (window.confirm(`Retirer « ${series.title} » et ses téléchargements ?`)) {
      await libraryRepository.removeSeries(series.key)
    }
  }

  return (
    <article className="library-card">
      <Link to={`/series/${encodeRouteKey(series.key)}`} className="library-card__link">
        <CoverArt seriesKey={series.key} title={series.title} />
        <div className="library-card__body">
          <p className="library-card__meta">{series.genres.filter((genre) => genre.toLowerCase() !== 'novel').slice(0, 2).join(' · ') || 'Roman'}</p>
          <h2>{series.title}</h2>
          <p className="library-card__continue">
            {currentChapter ? `Continuer · ${currentChapter.title}` : `${progress?.chapterCount ?? '—'} chapitres`}
          </p>
          <div className="progress-track" aria-label={`${percent}% terminé`}>
            <span style={{ width: `${percent}%` }} />
          </div>
        </div>
      </Link>
      <button className="library-card__remove" type="button" onClick={remove} aria-label={`Retirer ${series.title}`}>×</button>
    </article>
  )
}

export function LibraryPage() {
  const series = useLiveQuery(() => libraryRepository.listSeries(), [], [])

  useEffect(() => {
    navigator.storage?.persist?.().catch(() => undefined)
  }, [])

  return (
    <main className="shell">
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="LN Reader, accueil"><span>LN</span> Reader</a>
        <Link className="primary-button" to="/search">+ Ajouter</Link>
      </header>

      <section className="masthead">
        <p className="eyebrow">Bibliothèque personnelle</p>
        <h1>Histoires à<br /><em>emporter.</em></h1>
        <p className="lede">Votre progression reste sur cet appareil. Vos chapitres téléchargés aussi.</p>
      </section>

      {series.length === 0 ? (
        <section className="empty-state">
          <span className="empty-state__mark">文</span>
          <h2>Votre bibliothèque est vide</h2>
          <p>Recherchez un light novel, un web novel ou un roman pour commencer.</p>
          <Link className="primary-button" to="/search">Rechercher un titre</Link>
        </section>
      ) : (
        <section className="library-section" aria-labelledby="library-heading">
          <div className="section-heading">
            <h2 id="library-heading">Ma bibliothèque</h2>
            <span>{series.length} {series.length > 1 ? 'séries' : 'série'}</span>
          </div>
          <div className="library-grid">
            {series.map((item) => <LibraryCard key={item.key} series={item} />)}
          </div>
        </section>
      )}
    </main>
  )
}
