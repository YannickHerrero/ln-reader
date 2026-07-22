import { describe, expect, it } from 'vitest'
import { focusedTapDelta, isFocusedTap } from '../src/reader/focused-navigation'

describe('focused reader tap navigation', () => {
  it('maps the left and right halves to previous and next', () => {
    expect(focusedTapDelta(100, 390)).toBe(-1)
    expect(focusedTapDelta(300, 390)).toBe(1)
  })

  it('rejects scrolling, dragging, and long presses', () => {
    expect(isFocusedTap({ x: 300, y: 200 }, { x: 302, y: 205 }, 120)).toBe(true)
    expect(isFocusedTap({ x: 300, y: 200 }, { x: 302, y: 230 }, 120)).toBe(false)
    expect(isFocusedTap({ x: 300, y: 200 }, { x: 300, y: 200 }, 800)).toBe(false)
  })
})
