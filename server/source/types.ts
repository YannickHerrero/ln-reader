import type {
  SourceChapterContent,
  SourceDiscovery,
  SourceID,
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

export interface NovelSource {
  readonly id: SourceID
  search(query: string): Promise<SourceSearchResult[]>
  discover(): Promise<SourceDiscovery>
  series(key: string): Promise<SourceSeries>
  chapter(key: string): Promise<SourceChapterContent>
  ownsAsset(url: URL): boolean
  asset(url: string): Promise<{ body: Buffer; contentType: string }>
}

