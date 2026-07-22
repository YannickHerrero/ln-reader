import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { ReaderMode } from '../reader/preferences'

interface FocusedReaderProps {
  mode: Exclude<ReaderMode, 'continuous'>
  units: string[]
  index: number
  onIndexChange(index: number): void
  nextChapter?: { path: string; title: string }
}

export function FocusedReader({
  mode,
  units,
  index,
  onIndexChange,
  nextChapter,
}: FocusedReaderProps) {
  const maximum = Math.max(0, units.length - 1)
  const current = Math.max(0, Math.min(maximum, index))
  const label = mode === 'paragraph' ? 'Paragraphe' : 'Phrase'
  const text = units[current] ?? 'Aucun texte disponible.'
  const atStart = current === 0
  const atEnd = current === maximum

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return
      const target = event.target
      if (target instanceof Element && target.closest('button, a, input, select, textarea, [contenteditable="true"]')) return

      if ([' ', 'ArrowRight', 'ArrowDown', 'PageDown'].includes(event.key)) {
        event.preventDefault()
        if (!atEnd) onIndexChange(current + 1)
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key)) {
        event.preventDefault()
        if (!atStart) onIndexChange(current - 1)
      } else if (event.key === 'Home') {
        event.preventDefault()
        onIndexChange(0)
      } else if (event.key === 'End') {
        event.preventDefault()
        onIndexChange(maximum)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [atEnd, atStart, current, maximum, onIndexChange])

  return (
    <section className="reader-focus" aria-label={`Lecture par ${label.toLowerCase()}`}>
      <div className="reader-focus__stage">
        <p key={`${mode}-${current}`} className="reader-focus__text" aria-live="polite">{text}</p>
      </div>
      <footer className="reader-focus__controls">
        <button
          type="button"
          onClick={() => onIndexChange(current - 1)}
          disabled={atStart}
          aria-label={`${label} précédent`}
        >←</button>
        <div className="reader-focus__counter">
          <span>{label} {current + 1} sur {Math.max(1, units.length)}</span>
          <div aria-hidden="true"><i style={{ width: `${((current + 1) / Math.max(1, units.length)) * 100}%` }} /></div>
        </div>
        {atEnd && nextChapter ? (
          <Link to={nextChapter.path} aria-label={`Lire ${nextChapter.title}`}>→</Link>
        ) : (
          <button
            type="button"
            onClick={() => onIndexChange(current + 1)}
            disabled={atEnd}
            aria-label={`${label} suivant`}
          >→</button>
        )}
      </footer>
    </section>
  )
}
