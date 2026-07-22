export interface TapPoint {
  x: number
  y: number
}

export function focusedTapDelta(clientX: number, viewportWidth: number): -1 | 0 | 1 {
  if (clientX < viewportWidth / 3) return -1
  if (clientX >= (viewportWidth * 2) / 3) return 1
  return 0
}

export function isFocusedTap(start: TapPoint, end: TapPoint, durationMs: number): boolean {
  return Math.hypot(end.x - start.x, end.y - start.y) <= 12 && durationMs <= 600
}
