import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import type { SourceChapterContent } from '../../shared/contracts'
import { FocusedReader } from '../components/FocusedReader'
import { ReaderSettingsDialog } from '../components/ReaderSettingsDialog'
import { sourceApi } from '../api/source'
import { decodeRouteKey, encodeRouteKey } from '../app/route-key'
import type { ChapterRecord } from '../db/database'
import { libraryRepository } from '../db/repository'
import { calculateScrollRatio, isChapterComplete } from '../reader/progress'
import { loadReaderPreferences, saveReaderPreferences, type ReaderPreferences } from '../reader/preferences'
import { extractReaderParagraphs, ratioForUnit, splitReaderSentences, unitIndexFromRatio } from '../reader/segmentation'
import { sourceName } from '../source/labels'
import { sameVolume } from '../series/volumes'

function readerPath(seriesKey: string, chapterKey: string) {
  return `/read/${encodeRouteKey(seriesKey)}/${encodeRouteKey(chapterKey)}`
}

export function ReaderPage() {
  const { seriesId = '', chapterId = '' } = useParams()
  const seriesKey = decodeRouteKey(seriesId)
  const chapterKey = decodeRouteKey(chapterId)
  const series = useLiveQuery(
    async () => seriesKey ? (await libraryRepository.getSeries(seriesKey)) ?? null : null,
    [seriesKey],
  )
  const chapters = useLiveQuery(
    async () => seriesKey ? await libraryRepository.getChapters(seriesKey) : [] as ChapterRecord[],
    [seriesKey],
    [] as ChapterRecord[],
  )
  const savedProgress = useLiveQuery(
    async () => chapterKey ? (await libraryRepository.getChapterProgress(chapterKey)) ?? null : null,
    [chapterKey],
  )
  const download = useLiveQuery(
    async () => chapterKey ? (await libraryRepository.getDownload(chapterKey)) ?? null : null,
    [chapterKey],
  )
  const [content, setContent] = useState<SourceChapterContent | null>(null)
  const [offlineCopy, setOfflineCopy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [downloadBusy, setDownloadBusy] = useState(false)
  const [readerPreferences, setReaderPreferences] = useState(loadReaderPreferences)
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const restored = useRef(false)
  const latestRatio = useRef(0)

  const chapter = chapters.find((candidate) => candidate.key === chapterKey)
  const volumeChapters = chapter
    ? chapters.filter((candidate) => sameVolume(candidate.volume, chapter.volume))
    : chapters
  const chapterIndex = volumeChapters.findIndex((candidate) => candidate.key === chapterKey)
  const previousChapter = chapterIndex >= 0 ? volumeChapters[chapterIndex + 1] : undefined
  const nextChapter = chapterIndex > 0 ? volumeChapters[chapterIndex - 1] : undefined
  const readerParagraphs = useMemo(
    () => content ? extractReaderParagraphs(content.html) : [],
    [content],
  )
  const readerSentences = useMemo(
    () => splitReaderSentences(readerParagraphs),
    [readerParagraphs],
  )
  const focusedUnits = readerPreferences.mode === 'sentence' ? readerSentences : readerParagraphs
  const focusedRatio = ratioForUnit(focusedIndex, focusedUnits.length)
  const progressPercent = Math.round((readerPreferences.mode === 'continuous'
    ? savedProgress?.scrollRatio ?? 0
    : focusedRatio) * 100)

  useEffect(() => {
    restored.current = false
    latestRatio.current = 0
    setFocusedIndex(0)
    setContent(null)
    setError(null)
    if (download === undefined || !chapterKey || !chapter) return

    if (download) {
      setContent({
        key: download.chapterKey,
        title: download.title,
        html: download.html,
        source: download.source ?? (download.chapterKey.startsWith('novelFr:') ? 'novelFr' : 'mangasOrigines'),
      })
      setOfflineCopy(true)
      setLoading(false)
      return
    }

    const controller = new AbortController()
    setOfflineCopy(false)
    setLoading(true)
    sourceApi.chapter(chapterKey, chapter.releases, controller.signal)
      .then(setContent)
      .catch((caught) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        setError(navigator.onLine
          ? (caught instanceof Error ? caught.message : 'Le chapitre est indisponible.')
          : "Ce chapitre n'est pas téléchargé sur cet appareil.")
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [chapterKey, chapter, download])

  useEffect(() => {
    if (!content || !chapterKey || !seriesKey || savedProgress === undefined || restored.current) return
    restored.current = true
    const ratio = savedProgress?.scrollRatio ?? 0
    latestRatio.current = ratio
    if (readerPreferences.mode === 'continuous') {
      requestAnimationFrame(() => {
        const available = document.documentElement.scrollHeight - window.innerHeight
        window.scrollTo({ top: Math.max(0, available * ratio), behavior: 'instant' })
      })
    } else {
      setFocusedIndex(unitIndexFromRatio(focusedUnits.length, ratio))
    }
    void libraryRepository.saveProgress(seriesKey, chapterKey, ratio, savedProgress?.completed)
  }, [content, chapterKey, seriesKey, savedProgress, readerPreferences.mode, focusedUnits.length])

  useEffect(() => {
    if (!content || !chapterKey || !seriesKey || readerPreferences.mode !== 'continuous') return
    let timeout: ReturnType<typeof setTimeout> | undefined
    const save = () => {
      const ratio = calculateScrollRatio(window.scrollY, document.documentElement.scrollHeight, window.innerHeight)
      latestRatio.current = ratio
      void libraryRepository.saveProgress(seriesKey, chapterKey, ratio, isChapterComplete(ratio))
    }
    const onScroll = () => {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(save, 350)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (timeout) clearTimeout(timeout)
      void libraryRepository.saveProgress(seriesKey, chapterKey, latestRatio.current, isChapterComplete(latestRatio.current))
    }
  }, [content, chapterKey, seriesKey, readerPreferences.mode])

  useEffect(() => {
    if (series && chapter) document.title = `${chapter.title} · ${series.title}`
    return () => { document.title = 'LN Reader' }
  }, [series, chapter])

  useEffect(() => {
    if (readerPreferences.mode === 'continuous') return
    document.documentElement.classList.add('reader-focus-locked')
    document.body.classList.add('reader-focus-locked')
    window.scrollTo({ top: 0, behavior: 'instant' })
    return () => {
      document.documentElement.classList.remove('reader-focus-locked')
      document.body.classList.remove('reader-focus-locked')
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
  }, [readerPreferences.mode])

  const safeContent = useMemo(() => ({ __html: content?.html ?? '' }), [content?.html])
  const readerStyle = {
    '--reading-font-size': `${readerPreferences.fontSize}px`,
    '--reading-line-height': readerPreferences.lineHeight,
  } as CSSProperties

  if (series === undefined) return <main className="reader-state">Chargement…</main>
  if (!seriesKey || !chapterKey || series === null) return <Navigate to="/" replace />

  function currentReaderRatio(): number {
    if (readerPreferences.mode !== 'continuous') return focusedRatio
    const available = document.documentElement.scrollHeight - window.innerHeight
    return available > 0
      ? calculateScrollRatio(window.scrollY, document.documentElement.scrollHeight, window.innerHeight)
      : latestRatio.current
  }

  function changeReaderPreferences(preferences: ReaderPreferences) {
    const ratio = currentReaderRatio()
    const saved = saveReaderPreferences(preferences)
    latestRatio.current = ratio
    setReaderPreferences(saved)

    if (saved.mode === 'continuous') {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const availableAfter = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
        window.scrollTo({ top: availableAfter * ratio, behavior: 'instant' })
      }))
    } else {
      const nextUnits = saved.mode === 'sentence' ? readerSentences : readerParagraphs
      setFocusedIndex(unitIndexFromRatio(nextUnits.length, ratio))
    }

    if (seriesKey && chapterKey) {
      void libraryRepository.saveProgress(seriesKey, chapterKey, ratio, isChapterComplete(ratio))
    }
  }

  function changeFocusedIndex(index: number) {
    if (!seriesKey || !chapterKey) return
    const nextIndex = Math.max(0, Math.min(focusedUnits.length - 1, index))
    const ratio = ratioForUnit(nextIndex, focusedUnits.length)
    setFocusedIndex(nextIndex)
    latestRatio.current = ratio
    void libraryRepository.saveProgress(seriesKey, chapterKey, ratio, isChapterComplete(ratio))
  }

  async function toggleDownload() {
    if (!content || !seriesKey || !chapterKey) return
    setDownloadBusy(true)
    try {
      if (download) {
        await libraryRepository.removeDownload(chapterKey)
      } else {
        await libraryRepository.downloadChapter(seriesKey, content)
      }
    } finally {
      setDownloadBusy(false)
    }
  }

  return (
    <main
      className="reader-shell"
      data-reader-font={readerPreferences.fontFamily}
      data-reader-paper={readerPreferences.paper}
      data-reader-mode={readerPreferences.mode}
      style={readerStyle}
    >
      <header className="reader-bar">
        <Link to={`/series/${encodeRouteKey(seriesKey)}`} className="reader-back" aria-label="Retour à la série">←</Link>
        <div className="reader-bar__title"><strong>{series.title}</strong><span>{chapter?.title ?? content?.title ?? 'Chapitre'}</span></div>
        <ReaderSettingsDialog preferences={readerPreferences} onChange={changeReaderPreferences} />
        <button
          type="button"
          className={`reader-download ${download ? 'reader-download--active' : ''}`}
          onClick={toggleDownload}
          disabled={!content || downloadBusy}
          aria-label={download ? 'Supprimer le téléchargement' : 'Télécharger ce chapitre'}
        >{downloadBusy ? '…' : download ? '✓' : '↓'}</button>
        <div className="reader-progress"><span style={{ width: `${progressPercent}%` }} /></div>
      </header>

      {loading && <section className="reader-state"><span className="reader-pulse" />Chargement du chapitre…</section>}
      {error && <section className="reader-state reader-state--error"><h1>Lecture impossible</h1><p>{error}</p></section>}
      {content && readerPreferences.mode === 'continuous' && (
        <>
          <article className="reader-article">
            <div className="reader-kicker">
              <span>{offlineCopy ? 'Disponible hors ligne' : 'Lecture en ligne'} · {sourceName(content.source)}</span>
              <span>Lecture continue</span>
            </div>
            <h1>{chapter?.title ?? content.title}</h1>
            <div className="reader-copy" dangerouslySetInnerHTML={safeContent} />
          </article>
          <nav className="chapter-navigation" aria-label="Navigation entre chapitres">
            {previousChapter ? <Link to={readerPath(seriesKey, previousChapter.key)}>← <span>{previousChapter.title}</span></Link> : <span />}
            {nextChapter ? <Link to={readerPath(seriesKey, nextChapter.key)}><span>{nextChapter.title}</span> →</Link> : <Link to={`/series/${encodeRouteKey(seriesKey)}`}>Fin · Retour à la série</Link>}
          </nav>
        </>
      )}
      {content && readerPreferences.mode !== 'continuous' && (
        <FocusedReader
          mode={readerPreferences.mode}
          units={focusedUnits}
          index={focusedIndex}
          onIndexChange={changeFocusedIndex}
          nextChapter={nextChapter ? {
            path: readerPath(seriesKey, nextChapter.key),
            title: nextChapter.title,
          } : undefined}
        />
      )}
    </main>
  )
}
