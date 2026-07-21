import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CoverArt } from '../components/CoverArt'
import { ThemeToggle } from '../components/ThemeToggle'
import type { LibrarySeriesRecord } from '../db/database'
import { libraryRepository, type ContinueReadingEntry } from '../db/repository'
import { encodeRouteKey } from '../app/route-key'

function ContinueCard({ entry }: { entry: ContinueReadingEntry }) {
  return (
    <Link
      to={`/read/${encodeRouteKey(entry.series.key)}/${encodeRouteKey(entry.chapter.key)}`}
      className="continue-card"
      aria-label={`Reprendre la lecture ${entry.series.title} ${entry.chapter.title}`}
    >
      <div className="continue-card__art">
        <CoverArt seriesKey={entry.series.key} title={entry.series.title} />
        <span className="continue-card__play" aria-hidden="true">▶</span>
      </div>
      <div className="continue-card__copy">
        <p>Reprendre</p>
        <h3>{entry.series.title}</h3>
        <span>{entry.chapter.title}</span>
      </div>
    </Link>
  )
}

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
        <div className="library-card__visual">
          <CoverArt seriesKey={series.key} title={series.title} />
          <span className="library-card__play" aria-hidden="true">▶</span>
          <div className="progress-track" aria-label={`${percent}% terminé`}>
            <span style={{ width: `${percent}%` }} />
          </div>
        </div>
        <div className="library-card__body">
          <h2>{series.title}</h2>
          <p className="library-card__meta">{series.genres.filter((genre) => genre.toLowerCase() !== 'novel').slice(0, 2).join(' · ') || 'Roman'}</p>
          <p className="library-card__continue">
            {currentChapter ? currentChapter.title : `${progress?.chapterCount ?? '—'} chapitres`}
          </p>
        </div>
      </Link>
      <button className="library-card__remove" type="button" onClick={remove} aria-label={`Retirer ${series.title}`}>×</button>
    </article>
  )
}

export function LibraryPage() {
  const series = useLiveQuery(() => libraryRepository.listSeries(), [], [])
  const continueReading = useLiveQuery(() => libraryRepository.listContinueReading(), [], [])

  useEffect(() => {
    navigator.storage?.persist?.().catch(() => undefined)
  }, [])

  const featured = continueReading[0]

  return (
    <main className="shell">
      <header className="topbar">
        <Link className="wordmark" to="/" aria-label="LN Reader, accueil"><span>LN</span><strong>LN Reader</strong></Link>
        <nav className="topbar__nav" aria-label="Navigation principale">
          <Link className="topbar__nav-link topbar__nav-link--active" to="/">Bibliothèque</Link>
          <Link className="topbar__nav-link" to="/search">Découvrir</Link>
        </nav>
        <div className="topbar__actions">
          <ThemeToggle />
          <Link className="primary-button" to="/search"><span aria-hidden="true">＋</span> Ajouter</Link>
        </div>
      </header>

      <section className={`home-hero ${featured ? 'home-hero--featured' : ''}`}>
        {featured && <CoverArt seriesKey={featured.series.key} title={featured.series.title} className="home-hero__backdrop" decorative />}
        <div className="home-hero__shade" />
        <div className="home-hero__content">
          <p className="eyebrow">{featured ? 'Votre lecture du moment' : 'Votre bibliothèque personnelle'}</p>
          <h1>{featured ? featured.series.title : <>Toutes vos histoires.<br /><em>Un seul endroit.</em></>}</h1>
          <p className="lede">
            {featured
              ? featured.series.description || `Reprenez exactement où vous vous êtes arrêté avec ${featured.chapter.title}.`
              : 'Explorez des centaines de romans français et gardez progression et téléchargements sur cet appareil.'}
          </p>
          <div className="home-hero__actions">
            {featured ? (
              <Link className="primary-button primary-button--hero" to={`/read/${encodeRouteKey(featured.series.key)}/${encodeRouteKey(featured.chapter.key)}`}>
                <span aria-hidden="true">▶</span> Continuer
              </Link>
            ) : (
              <Link className="primary-button primary-button--hero" to="/search">Rechercher un titre</Link>
            )}
            <Link className="secondary-button" to="/search">Découvrir le catalogue</Link>
          </div>
          {featured && <p className="home-hero__chapter">À suivre · {featured.chapter.title}</p>}
        </div>
      </section>

      {continueReading.length > 0 && (
        <section className="continue-section" aria-labelledby="continue-heading">
          <div className="section-heading">
            <h2 id="continue-heading">Continuer</h2>
            <span>Reprenez là où vous vous êtes arrêté</span>
          </div>
          <div className="continue-row">
            {continueReading.map((entry) => (
              <ContinueCard key={entry.series.key} entry={entry} />
            ))}
          </div>
        </section>
      )}

      {series.length === 0 ? (
        <section className="empty-state">
          <span className="empty-state__mark">文</span>
          <h2>Votre liste est encore vide</h2>
          <p>Ajoutez un light novel, un web novel ou un roman pour le retrouver ici.</p>
          <Link className="primary-button" to="/search">Explorer le catalogue</Link>
        </section>
      ) : (
        <section className="library-section" aria-labelledby="library-heading">
          <div className="section-heading">
            <h2 id="library-heading">Ma liste</h2>
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
