export type SourceID = 'novelFr'

export interface ApiCapabilities {
  apiVersion: 1
  features: Array<'chapterBlocks' | 'sync'>
}

export interface SourceReference {
  source: SourceID
  key: string
}

export interface SourceSearchResult {
  key: string
  title: string
  sourceType: 'text'
  sources: SourceReference[]
}

export interface SourceBrowseResult {
  key: string
  title: string
  coverImage: string | null
  sources: SourceReference[]
}

export interface SourceDiscovery {
  popular: SourceBrowseResult[]
  recentlyAdded: SourceBrowseResult[]
  recentlyUpdated: SourceBrowseResult[]
}

export interface SourceChapter {
  key: string
  title: string
  number: number | null
  volume: number | null
  publishedAt: string | null
  releases: SourceReference[]
}

export interface SourceSeries {
  key: string
  title: string
  sources: SourceReference[]
  coverImage: string | null
  author: string | null
  description: string | null
  genres: string[]
  status: string | null
  chapters: SourceChapter[]
}

export type SourceChapterBlockKind = 'paragraph' | 'heading2' | 'heading3' | 'blockquote' | 'listItem' | 'divider'

export interface SourceChapterBlock {
  kind: SourceChapterBlockKind
  text: string
}

export interface SourceChapterContent {
  key: string
  title: string
  html: string
  blocks?: SourceChapterBlock[]
  source: SourceID
}

export interface ApiErrorBody {
  error: string
}
