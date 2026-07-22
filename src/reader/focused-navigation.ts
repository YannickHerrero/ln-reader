export interface TapPoint {
  x: number
  y: number
}

export function focusedTapDelta(clientX: number, viewportWidth: number): -1 | 1 {
  return clientX < viewportWidth / 2 ? -1 : 1
}

export function isFocusedTap(start: TapPoint, end: TapPoint, durationMs: number): boolean {
  return Math.hypot(end.x - start.x, end.y - start.y) <= 12 && durationMs <= 600
}
