import { describe, expect, it } from 'vitest'

describe('application scaffold', () => {
  it('provides a browser document for frontend tests', () => {
    expect(document).toBeDefined()
  })
})
