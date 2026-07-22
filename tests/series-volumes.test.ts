import { describe, expect, it } from 'vitest'
import { groupChaptersByVolume, sameVolume, volumeLabel } from '../src/series/volumes'

describe('series volumes', () => {
  it('keeps repeated chapter numbers in separate volume groups', () => {
    const groups = groupChaptersByVolume([
      { key: 'v2-c1', volume: 2, number: 1 },
      { key: 'v1-c1', volume: 1, number: 1 },
      { key: 'prologue', volume: null, number: 0 },
    ])

    expect(groups.map((group) => [group.label, group.chapters.map((chapter) => chapter.key)])).toEqual([
      ['Volume 2', ['v2-c1']],
      ['Volume 1', ['v1-c1']],
      ['Prologue / Extras', ['prologue']],
    ])
  })

  it('formats decimal volumes and compares nullable volume identities', () => {
    expect(volumeLabel(8.5)).toBe('Volume 8,5')
    expect(sameVolume(8.5, 8.5)).toBe(true)
    expect(sameVolume(null, null)).toBe(true)
    expect(sameVolume(null, 1)).toBe(false)
  })
})
