export interface VolumeChapter {
  volume: number | null
}

export interface ChapterVolume<T extends VolumeChapter> {
  key: string
  volume: number | null
  label: string
  chapters: T[]
}

export function volumeKey(volume: number | null): string {
  return volume === null ? 'extras' : `volume:${Math.round(volume * 1_000)}`
}

export function formatVolumeNumber(volume: number): string {
  return Number.isInteger(volume) ? String(volume) : String(volume).replace('.', ',')
}

export function volumeLabel(volume: number | null): string {
  return volume === null ? 'Prologue / Extras' : `Volume ${formatVolumeNumber(volume)}`
}

export function sameVolume(left: number | null, right: number | null): boolean {
  if (left === null || right === null) return left === right
  return Math.abs(left - right) < Number.EPSILON
}

export function groupChaptersByVolume<T extends VolumeChapter>(chapters: T[]): ChapterVolume<T>[] {
  const groups = new Map<string, ChapterVolume<T>>()
  for (const chapter of chapters) {
    const key = volumeKey(chapter.volume)
    const group = groups.get(key)
    if (group) group.chapters.push(chapter)
    else groups.set(key, {
      key,
      volume: chapter.volume,
      label: volumeLabel(chapter.volume),
      chapters: [chapter],
    })
  }
  return [...groups.values()]
}
