import { describe, expect, it } from 'vitest'
import { calculateScrollRatio, isChapterComplete } from '../src/reader/progress'

describe('reader progress', () => {
  it('calculates and bounds continuous scroll progress', () => {
    expect(calculateScrollRatio(450, 1_000, 100)).toBe(0.5)
    expect(calculateScrollRatio(-20, 1_000, 100)).toBe(0)
    expect(calculateScrollRatio(2_000, 1_000, 100)).toBe(1)
    expect(calculateScrollRatio(0, 500, 500)).toBe(1)
  })

  it('completes a chapter near its end', () => {
    expect(isChapterComplete(0.949)).toBe(false)
    expect(isChapterComplete(0.95)).toBe(true)
  })
})
