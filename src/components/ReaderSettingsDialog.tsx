import { useMemo, useRef, type CSSProperties } from 'react'
import {
  DEFAULT_READER_PREFERENCES,
  normalizeReaderPreferences,
  READER_FONT_SIZE,
  READER_LINE_HEIGHT,
  READER_PAPER_PRESETS,
  type ReaderPreferences,
} from '../reader/preferences'

interface ReaderSettingsDialogProps {
  preferences: ReaderPreferences
  onChange(preferences: ReaderPreferences): void
}

function closeDialog(dialog: HTMLDialogElement | null) {
  if (!dialog) return
  if (typeof dialog.close === 'function') dialog.close()
  else dialog.removeAttribute('open')
}

export function ReaderSettingsDialog({ preferences, onChange }: ReaderSettingsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const selectedPaper = useMemo(
    () => READER_PAPER_PRESETS.find((preset) => preset.id === preferences.paper) ?? READER_PAPER_PRESETS[0]!,
    [preferences.paper],
  )
  const previewStyle = {
    '--preview-paper': selectedPaper.id === 'auto' ? 'var(--reader-bg)' : selectedPaper.background,
    '--preview-ink': selectedPaper.id === 'auto' ? 'var(--reader-copy)' : selectedPaper.foreground,
    '--preview-family': preferences.fontFamily === 'serif'
      ? 'Georgia, "Times New Roman", serif'
      : 'Inter, ui-sans-serif, sans-serif',
    '--preview-size': `${Math.min(preferences.fontSize, 21)}px`,
    '--preview-leading': preferences.lineHeight,
  } as CSSProperties

  function open() {
    const dialog = dialogRef.current
    if (!dialog) return
    if (typeof dialog.showModal === 'function') dialog.showModal()
    else dialog.setAttribute('open', '')
  }

  function close() {
    closeDialog(dialogRef.current)
    triggerRef.current?.focus()
  }

  function update(changes: Partial<ReaderPreferences>) {
    onChange(normalizeReaderPreferences({ ...preferences, ...changes }))
  }

  return (
    <>
      <button
        ref={triggerRef}
        className="reader-settings-trigger"
        type="button"
        onClick={open}
        aria-label="Options de lecture"
        aria-haspopup="dialog"
      >Aa</button>

      <dialog
        ref={dialogRef}
        className="reader-settings-dialog"
        aria-labelledby="reader-settings-title"
        onClose={() => triggerRef.current?.focus()}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) close()
        }}
      >
        <div className="reader-settings-sheet">
          <header className="reader-settings-header">
            <div>
              <p className="eyebrow">Confort de lecture</p>
              <h2 id="reader-settings-title">Apparence du texte</h2>
            </div>
            <button type="button" onClick={close} aria-label="Fermer les options de lecture">×</button>
          </header>

          <div className="reader-settings-body">
            <div className="reader-settings-preview" style={previewStyle} aria-label="Aperçu de lecture">
              <span>Votre aperçu</span>
              <p>Une histoire devrait toujours être agréable à lire.</p>
            </div>

            <section className="reader-settings-group" aria-labelledby="text-settings-title">
              <div className="reader-settings-group__title">
                <h3 id="text-settings-title">Texte</h3>
                <button type="button" onClick={() => onChange({ ...DEFAULT_READER_PREFERENCES })}>Réinitialiser</button>
              </div>

              <div className="reader-stepper">
                <span>Taille</span>
                <div>
                  <button
                    type="button"
                    onClick={() => update({ fontSize: preferences.fontSize - READER_FONT_SIZE.step })}
                    disabled={preferences.fontSize <= READER_FONT_SIZE.min}
                    aria-label="Diminuer la taille du texte"
                  >A−</button>
                  <output aria-live="polite">{preferences.fontSize} px</output>
                  <button
                    type="button"
                    onClick={() => update({ fontSize: preferences.fontSize + READER_FONT_SIZE.step })}
                    disabled={preferences.fontSize >= READER_FONT_SIZE.max}
                    aria-label="Augmenter la taille du texte"
                  >A＋</button>
                </div>
              </div>

              <div className="reader-stepper">
                <span>Interligne</span>
                <div>
                  <button
                    type="button"
                    onClick={() => update({ lineHeight: preferences.lineHeight - READER_LINE_HEIGHT.step })}
                    disabled={preferences.lineHeight <= READER_LINE_HEIGHT.min}
                    aria-label="Diminuer l’interligne"
                  >−</button>
                  <output aria-live="polite">{preferences.lineHeight.toFixed(1)}</output>
                  <button
                    type="button"
                    onClick={() => update({ lineHeight: preferences.lineHeight + READER_LINE_HEIGHT.step })}
                    disabled={preferences.lineHeight >= READER_LINE_HEIGHT.max}
                    aria-label="Augmenter l’interligne"
                  >＋</button>
                </div>
              </div>

              <fieldset className="reader-font-options">
                <legend>Police</legend>
                <label>
                  <input
                    type="radio"
                    name="reader-font"
                    value="serif"
                    checked={preferences.fontFamily === 'serif'}
                    onChange={() => update({ fontFamily: 'serif' })}
                  />
                  <span className="reader-font-options__serif">Serif</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="reader-font"
                    value="sans"
                    checked={preferences.fontFamily === 'sans'}
                    onChange={() => update({ fontFamily: 'sans' })}
                  />
                  <span>Sans-serif</span>
                </label>
              </fieldset>
            </section>

            <fieldset className="reader-paper-options">
              <legend>Type de papier</legend>
              <div className="reader-paper-grid">
                {READER_PAPER_PRESETS.map((preset) => (
                  <label key={preset.id}>
                    <input
                      type="radio"
                      name="reader-paper"
                      value={preset.id}
                      checked={preferences.paper === preset.id}
                      onChange={() => update({ paper: preset.id })}
                    />
                    <span className="reader-paper-card">
                      <i style={{ background: preset.background, color: preset.foreground }} aria-hidden="true">Aa</i>
                      <strong>{preset.label}</strong>
                      <small>{preset.description}</small>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <footer className="reader-settings-footer">
            <button className="primary-button" type="button" onClick={close}>Terminé</button>
          </footer>
        </div>
      </dialog>
    </>
  )
}
