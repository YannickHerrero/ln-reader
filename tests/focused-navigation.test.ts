import { describe, expect, it } from 'vitest'
import { focusedTapDelta, isFocusedTap } from '../src/reader/focused-navigation'

describe('focused reader tap navigation', () => {
  it('maps screen thirds to previous, controls, and next', () => {
    expect(focusedTapDelta(0, 390)).toBe(-1)
    expect(focusedTapDelta(129, 390)).toBe(-1)
    expect(focusedTapDelta(130, 390)).toBe(0)
    expect(focusedTapDelta(259, 390)).toBe(0)
    expect(focusedTapDelta(260, 390)).toBe(1)
    expect(focusedTapDelta(389, 390)).toBe(1)
  })

  it('rejects scrolling, dragging, and long presses', () => {
    expect(isFocusedTap({ x: 300, y: 200 }, { x: 302, y: 205 }, 120)).toBe(true)
    expect(isFocusedTap({ x: 300, y: 200 }, { x: 302, y: 230 }, 120)).toBe(false)
    expect(isFocusedTap({ x: 300, y: 200 }, { x: 300, y: 200 }, 800)).toBe(false)
  })
})
