export type SourceID = 'novelFr' | 'mangasOrigines'

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

export interface SourceChapterContent {
  key: string
  title: string
  html: string
  source: SourceID
}

export interface ApiErrorBody {
  error: string
}
