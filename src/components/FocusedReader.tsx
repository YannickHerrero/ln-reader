import { useEffect, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { focusedTapDelta, isFocusedTap } from '../reader/focused-navigation'
import type { ReaderMode } from '../reader/preferences'

interface FocusedReaderProps {
  mode: Exclude<ReaderMode, 'continuous'>
  units: string[]
  index: number
  onIndexChange(index: number): void
  nextChapter?: { key: string; path: string; title: string }
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
  const pointerStart = useRef<{ id: number; x: number; y: number; startedAt: number } | null>(null)

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

  function beginTap(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.isPrimary === false || (event.pointerType === 'mouse' && event.button !== 0)) return
    pointerStart.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startedAt: performance.now(),
    }
  }

  function finishTap(event: ReactPointerEvent<HTMLDivElement>) {
    const start = pointerStart.current
    pointerStart.current = null
    if (!start || start.id !== event.pointerId) return
    if (!isFocusedTap(start, { x: event.clientX, y: event.clientY }, performance.now() - start.startedAt)
      || window.getSelection()?.toString()) return

    const delta = focusedTapDelta(event.clientX, window.innerWidth)
    if (delta < 0 && !atStart) onIndexChange(current - 1)
    if (delta > 0 && !atEnd) onIndexChange(current + 1)
  }

  return (
    <section className="reader-focus" aria-label={`Lecture par ${label.toLowerCase()}`}>
      <div
        className="reader-focus__stage"
        onPointerDown={beginTap}
        onPointerUp={finishTap}
        onPointerCancel={() => { pointerStart.current = null }}
      >
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
          <input
            className="reader-focus__seek"
            type="range"
            min={0}
            max={maximum}
            step={1}
            value={current}
            disabled={maximum === 0}
            onChange={(event) => onIndexChange(Number(event.currentTarget.value))}
            aria-label={`Aller à ${label === 'Phrase' ? 'une phrase' : 'un paragraphe'}`}
            aria-valuetext={`${label} ${current + 1} sur ${Math.max(1, units.length)}`}
            style={{ '--focus-progress': `${((current + 1) / Math.max(1, units.length)) * 100}%` } as CSSProperties}
          />
        </div>
        {atEnd && nextChapter ? (
          <Link
            to={nextChapter.path}
            state={{ startChapterAtBeginning: nextChapter.key }}
            aria-label={`Lire ${nextChapter.title}`}
          >→</Link>
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
