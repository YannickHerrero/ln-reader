export function seriesSyncKey(seriesKey: string): string {
  return `series:${seriesKey}`
}

export function progressSyncKey(chapterKey: string): string {
  return `progress:${chapterKey}`
}
