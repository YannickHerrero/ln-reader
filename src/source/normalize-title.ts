export function normalizeSeriesTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(?:light|web)?\s*novel\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
