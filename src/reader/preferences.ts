export type ReaderFontFamily = 'serif' | 'sans'
export type ReaderPaper = 'auto' | 'ivory' | 'white' | 'black' | 'softDark'
export type ReaderMode = 'continuous' | 'paragraph' | 'sentence'

export interface ReaderPreferences {
  fontSize: number
  lineHeight: number
  fontFamily: ReaderFontFamily
  paper: ReaderPaper
  mode: ReaderMode
}

export interface ReaderPaperPreset {
  id: ReaderPaper
  label: string
  description: string
  background: string
  foreground: string
}

export const READER_PREFERENCES_KEY = 'ln-reader-reading-preferences'
export const READER_FONT_SIZE = { min: 15, max: 28, step: 1 } as const
export const READER_LINE_HEIGHT = { min: 1.4, max: 2.2, step: 0.1 } as const

export const DEFAULT_READER_PREFERENCES: ReaderPreferences = {
  fontSize: 19,
  lineHeight: 1.8,
  fontFamily: 'serif',
  paper: 'auto',
  mode: 'continuous',
}

export const READER_PAPER_PRESETS: ReaderPaperPreset[] = [
  { id: 'auto', label: 'Auto', description: "Suit l'apparence de l'application", background: 'linear-gradient(135deg, #f7f7f8 50%, #101013 50%)', foreground: '#e50914' },
  { id: 'ivory', label: 'Ivoire', description: 'Papier chaud, texte charbon', background: '#f4efe4', foreground: '#292620' },
  { id: 'white', label: 'Blanc', description: 'Fond blanc, texte noir', background: '#ffffff', foreground: '#111113' },
  { id: 'black', label: 'Noir', description: 'Fond noir, texte blanc', background: '#050506', foreground: '#ffffff' },
  { id: 'softDark', label: 'Nuit douce', description: 'Fond charbon, texte gris clair', background: '#111318', foreground: '#d5d6da' },
]

const FONT_FAMILIES = new Set<ReaderFontFamily>(['serif', 'sans'])
const PAPERS = new Set<ReaderPaper>(READER_PAPER_PRESETS.map((preset) => preset.id))
const MODES = new Set<ReaderMode>(['continuous', 'paragraph', 'sentence'])

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback
}

export function normalizeReaderPreferences(value: unknown): ReaderPreferences {
  const candidate = value && typeof value === 'object' ? value as Partial<ReaderPreferences> : {}
  const lineHeight = clamp(
    candidate.lineHeight,
    READER_LINE_HEIGHT.min,
    READER_LINE_HEIGHT.max,
    DEFAULT_READER_PREFERENCES.lineHeight,
  )

  return {
    fontSize: Math.round(clamp(
      candidate.fontSize,
      READER_FONT_SIZE.min,
      READER_FONT_SIZE.max,
      DEFAULT_READER_PREFERENCES.fontSize,
    )),
    lineHeight: Math.round(lineHeight * 10) / 10,
    fontFamily: FONT_FAMILIES.has(candidate.fontFamily as ReaderFontFamily)
      ? candidate.fontFamily as ReaderFontFamily
      : DEFAULT_READER_PREFERENCES.fontFamily,
    paper: PAPERS.has(candidate.paper as ReaderPaper)
      ? candidate.paper as ReaderPaper
      : DEFAULT_READER_PREFERENCES.paper,
    mode: MODES.has(candidate.mode as ReaderMode)
      ? candidate.mode as ReaderMode
      : DEFAULT_READER_PREFERENCES.mode,
  }
}

export function loadReaderPreferences(storage: Pick<Storage, 'getItem'> = localStorage): ReaderPreferences {
  try {
    const stored = storage.getItem(READER_PREFERENCES_KEY)
    return stored ? normalizeReaderPreferences(JSON.parse(stored)) : { ...DEFAULT_READER_PREFERENCES }
  } catch {
    return { ...DEFAULT_READER_PREFERENCES }
  }
}

export function saveReaderPreferences(
  preferences: ReaderPreferences,
  storage: Pick<Storage, 'setItem'> = localStorage,
): ReaderPreferences {
  const normalized = normalizeReaderPreferences(preferences)
  try {
    storage.setItem(READER_PREFERENCES_KEY, JSON.stringify(normalized))
  } catch {
    // Reading preferences remain active for the current session when storage is unavailable.
  }
  return normalized
}
