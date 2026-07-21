export function calculateScrollRatio(
  scrollTop: number,
  scrollHeight: number,
  viewportHeight: number,
): number {
  const available = scrollHeight - viewportHeight
  if (available <= 0) return 1
  return Math.max(0, Math.min(1, scrollTop / available))
}

export function isChapterComplete(ratio: number): boolean {
  return ratio >= 0.95
}
