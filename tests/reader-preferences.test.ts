import { describe, expect, it } from 'vitest'
import {
  DEFAULT_READER_PREFERENCES,
  loadReaderPreferences,
  normalizeReaderPreferences,
  READER_PREFERENCES_KEY,
  saveReaderPreferences,
} from '../src/reader/preferences'

describe('reader preferences', () => {
  it('uses recommended defaults when nothing is stored', () => {
    expect(loadReaderPreferences()).toEqual(DEFAULT_READER_PREFERENCES)
  })

  it('clamps numbers and rejects unknown options', () => {
    expect(normalizeReaderPreferences({
      fontSize: 80,
      lineHeight: 1.03,
      fontFamily: 'comic',
      paper: 'green',
      mode: 'speed',
    })).toEqual({
      fontSize: 28,
      lineHeight: 1.4,
      fontFamily: 'serif',
      paper: 'auto',
      mode: 'continuous',
    })
  })

  it('persists and restores valid preferences', () => {
    const preferences = saveReaderPreferences({
      fontSize: 22,
      lineHeight: 2,
      fontFamily: 'sans',
      paper: 'softDark',
      mode: 'sentence',
    })

    expect(JSON.parse(localStorage.getItem(READER_PREFERENCES_KEY) ?? '')).toEqual(preferences)
    expect(loadReaderPreferences()).toEqual(preferences)
  })

  it('recovers from malformed stored data', () => {
    localStorage.setItem(READER_PREFERENCES_KEY, '{not json')
    expect(loadReaderPreferences()).toEqual(DEFAULT_READER_PREFERENCES)
  })
})
