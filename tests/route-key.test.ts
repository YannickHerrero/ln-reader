import { describe, expect, it } from 'vitest'
import { decodeRouteKey, encodeRouteKey } from '../src/app/route-key'

describe('route keys', () => {
  it('round trips source paths without slashes in the route id', () => {
    const encoded = encodeRouteKey('/oeuvre/the-authors-pov/')

    expect(encoded).not.toContain('/')
    expect(decodeRouteKey(encoded)).toBe('/oeuvre/the-authors-pov/')
  })

  it('rejects unrelated decoded values', () => {
    expect(decodeRouteKey(encodeRouteKey('/not-a-series/'))).toBeNull()
  })
})
