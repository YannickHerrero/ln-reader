import type {
  ApiErrorBody,
  SourceChapterContent,
  SourceDiscovery,
  SourceReference,
  SourceSearchResult,
  SourceSeries,
} from '../../shared/contracts'

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal })
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'La source est indisponible.' })) as ApiErrorBody
    throw new Error(body.error || 'La source est indisponible.')
  }
  return response.json() as Promise<T>
}

export const sourceApi = {
  search(query: string, signal?: AbortSignal) {
    return request<SourceSearchResult[]>(`/api/source/search?q=${encodeURIComponent(query)}`, signal)
  },

  discover(signal?: AbortSignal) {
    return request<SourceDiscovery>('/api/source/discover', signal)
  },

  series(key: string, signal?: AbortSignal) {
    return request<SourceSeries>(`/api/source/series?key=${encodeURIComponent(key)}`, signal)
  },

  chapter(key: string, releases: SourceReference[] = [], signal?: AbortSignal) {
    const params = new URLSearchParams({ key })
    if (releases.length) params.set('releases', JSON.stringify(releases))
    return request<SourceChapterContent>(`/api/source/chapter?${params}`, signal)
  },

  async cover(url: string): Promise<Blob> {
    const response = await fetch(`/api/source/asset?url=${encodeURIComponent(url)}`)
    if (!response.ok) throw new Error('La couverture est indisponible.')
    return response.blob()
  },
}
