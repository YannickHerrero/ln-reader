import type {
  SourceChapterContent,
  SourceDiscovery,
  SourceID,
  SourceReference,
  SourceSearchResult,
  SourceSeries,
} from '../../shared/contracts'

export interface SourceService {
  search(query: string): Promise<SourceSearchResult[]>
  discover(): Promise<SourceDiscovery>
  series(key: string): Promise<SourceSeries>
  chapter(key: string, releases?: SourceReference[]): Promise<SourceChapterContent>
  asset(url: string): Promise<{ body: Buffer; contentType: string }>
}

export interface NovelSource {
  readonly id: SourceID
  search(query: string): Promise<SourceSearchResult[]>
  discover(): Promise<SourceDiscovery>
  series(key: string): Promise<SourceSeries>
  chapter(key: string): Promise<SourceChapterContent>
  ownsAsset(url: URL): boolean
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
