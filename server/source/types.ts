import type {
  SourceChapterContent,
  SourceDiscovery,
  SourceSearchResult,
  SourceSeries,
} from '../../shared/contracts'

export interface SourceService {
  search(query: string): Promise<SourceSearchResult[]>
  discover(): Promise<SourceDiscovery>
  series(key: string): Promise<SourceSeries>
  chapter(key: string): Promise<SourceChapterContent>
  asset(url: string): Promise<{ body: Buffer; contentType: string }>
}

export interface BrowserResponse {
  status: number
  contentType: string
  body: Buffer
}

export interface SourceHttpClient {
  request(
    path: string,
    options?: { method?: 'GET' | 'POST'; headers?: Record<string, string>; body?: string; pace?: boolean },
  ): Promise<BrowserResponse>
  close(): Promise<void>
}
