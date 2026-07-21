import type { SourceID, SourceReference } from '../../shared/contracts'

export function sourceName(source: SourceID): string {
  return source === 'novelFr' ? 'Novel-FR' : 'Mangas-Origines'
}

export function sourcesLabel(sources: SourceReference[]): string {
  if (sources.length > 1) return `${sources.length} sources`
  return sources[0] ? sourceName(sources[0].source) : 'Source inconnue'
}
