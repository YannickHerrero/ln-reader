export function encodeRouteKey(key: string): string {
  return btoa(key).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

export function decodeRouteKey(value: string): string | null {
  try {
    const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const key = atob(padded)
    return key.startsWith('/oeuvre/') ? key : null
  } catch {
    return null
  }
}
