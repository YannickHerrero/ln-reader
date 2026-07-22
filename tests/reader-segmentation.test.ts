import { describe, expect, it } from 'vitest'
import {
  extractReaderParagraphs,
  ratioForUnit,
  splitReaderSentences,
  unitIndexFromRatio,
} from '../src/reader/segmentation'

describe('focused reader segmentation', () => {
  it('extracts semantic paragraphs and normalizes decorative whitespace', () => {
    expect(extractReaderParagraphs(`
      <p>Une première\nligne&nbsp;réunie.</p>
      <blockquote><p>Une citation.</p></blockquote>
      <h2>Un interlude</h2>
      <p>La suite.</p>
    `)).toEqual([
      'Une première ligne réunie.',
      'Une citation.',
      'Un interlude',
      'La suite.',
    ])
  })

  it('falls back to line breaks when markup has no semantic blocks', () => {
    expect(extractReaderParagraphs('<div>Première ligne.<br><br>Deuxième ligne.</div>'))
      .toEqual(['Première ligne.', 'Deuxième ligne.'])
  })

  it('keeps abbreviations, decimals, and closing quotes inside sentences', () => {
    const paragraphs = [
      'Mme. Layvin nota 3.14 points. Elle dit : « Parfait ! » Puis Dr. Kane sourit.',
    ]
    expect(splitReaderSentences(paragraphs)).toEqual([
      'Mme. Layvin nota 3.14 points.',
      'Elle dit : « Parfait ! »',
      'Puis Dr. Kane sourit.',
    ])
  })

  it('keeps punctuation clusters and paragraph boundaries', () => {
    expect(splitReaderSentences(['Vraiment ?! Oui…', 'Nouveau paragraphe.'])).toEqual([
      'Vraiment ?!',
      'Oui…',
      'Nouveau paragraphe.',
    ])
  })

  it('maps focused units to canonical progress ratios', () => {
    expect(ratioForUnit(2, 5)).toBe(0.5)
    expect(unitIndexFromRatio(5, 0.5)).toBe(2)
    expect(ratioForUnit(0, 1)).toBe(1)
    expect(unitIndexFromRatio(100, 0.95)).toBe(94)
  })
})
