export interface SourceSearchResult {
  key: string
  title: string
  sourceType: 'text'
}

export interface SourceChapter {
  key: string
  title: string
  number: number | null
  publishedAt: string | null
}

export interface SourceSeries {
  key: string
  title: string
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
}

export interface ApiErrorBody {
  error: string
}
