import type {
  SourceBrowseResult,
  SourceChapter,
  SourceChapterContent,
  SourceDiscovery,
  SourceID,
  SourceReference,
  SourceSearchResult,
  SourceSeries,
} from '../../shared/contracts'
import type { NovelSource, SourceService } from './types'

const SOURCE_PRIORITY: SourceID[] = ['novelFr', 'mangasOrigines']

function normalizeTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(?:light|web)?\s*novel\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function sourceRank(source: SourceID): number {
  return SOURCE_PRIORITY.indexOf(source)
}

function displayTitle(titles: string[]): string {
  const best = [...titles].sort((left, right) => {
    const score = (value: string) => (value.match(/[A-ZÀ-ÖØ-Þ]/g) ?? []).length
    return score(right) - score(left)
  })[0] ?? titles[0] ?? ''
  return best.replace(/\s+[–-]\s+(?:light\s+|web\s+)?novel\s*$/i, '').trim()
}

function sortedReferences(references: SourceReference[]): SourceReference[] {
  const seen = new Set<string>()
  return [...references]
    .sort((left, right) => sourceRank(left.source) - sourceRank(right.source))
    .filter((reference) => {
      const identity = `${reference.source}:${reference.key}`
      if (seen.has(identity)) return false
      seen.add(identity)
      return true
    })
}

function mergeListings<T extends SourceSearchResult | SourceBrowseResult>(
  groups: T[][],
): T[] {
  const merged = new Map<string, T>()
  for (const items of groups) {
    for (const item of items) {
      const identity = normalizeTitle(item.title)
      if (!identity) continue
      const existing = merged.get(identity)
      if (!existing) {
        merged.set(identity, { ...item, sources: sortedReferences(item.sources) })
        continue
      }
      const sources = sortedReferences([...existing.sources, ...item.sources])
      const preferred = sources[0]
      merged.set(identity, {
        ...existing,
        key: preferred?.key ?? existing.key,
        title: displayTitle([existing.title, item.title]),
        sources,
        ...('coverImage' in existing && 'coverImage' in item && !existing.coverImage && item.coverImage
          ? { coverImage: item.coverImage }
          : {}),
      })
    }
  }
  return [...merged.values()]
}

function chapterIdentity(chapter: SourceChapter): string {
  if (chapter.number !== null) return `number:${chapter.number}`
  return `title:${normalizeTitle(chapter.title)}`
}

export class MergedSourceService implements SourceService {
  private readonly byID: Map<SourceID, NovelSource>

  constructor(private readonly sources: NovelSource[]) {
    this.byID = new Map(sources.map((source) => [source.id, source]))
  }

  async search(query: string): Promise<SourceSearchResult[]> {
    const results = await Promise.allSettled(this.sources.map((source) => source.search(query)))
    const successful = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])
    if (successful.length === 0) throw new Error('Every novel source failed during search.')
    return mergeListings(successful)
  }

  async discover(): Promise<SourceDiscovery> {
    const results = await Promise.allSettled(this.sources.map((source) => source.discover()))
    const successful = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])
    if (successful.length === 0) throw new Error('Every novel source failed during discovery.')
    return {
      popular: mergeListings(successful.map((result) => result.popular)),
      recentlyAdded: mergeListings(successful.map((result) => result.recentlyAdded)),
      recentlyUpdated: mergeListings(successful.map((result) => result.recentlyUpdated)),
    }
  }

  async series(key: string): Promise<SourceSeries> {
    const requestedSource = this.sourceForKey(key)
    const requestedSeries = await requestedSource.series(key)
    const matches: SourceSeries[] = [requestedSeries]

    for (const source of this.sources) {
      if (source.id === requestedSource.id) continue
      try {
        const candidates = await source.search(requestedSeries.title)
        const matching = candidates.find((candidate) => normalizeTitle(candidate.title) === normalizeTitle(requestedSeries.title))
        if (matching) matches.push(await source.series(matching.key))
      } catch {
        // A secondary source must never make the preferred source unreadable.
      }
    }

    return this.mergeSeries(key, requestedSource.id, matches)
  }

  async chapter(key: string, releases?: SourceReference[]): Promise<SourceChapterContent> {
    const candidates = sortedReferences(releases?.length
      ? releases
      : [{ source: this.sourceForKey(key).id, key }])
    let lastError: unknown
    for (const candidate of candidates) {
      const source = this.byID.get(candidate.source)
      if (!source) continue
      try {
        const content = await source.chapter(candidate.key)
        return { ...content, key }
      } catch (error) {
        lastError = error
      }
    }
    throw lastError ?? new Error('No source carries this chapter.')
  }

  async asset(rawUrl: string): Promise<{ body: Buffer; contentType: string }> {
    const url = new URL(rawUrl)
    const source = this.sources.find((candidate) => candidate.ownsAsset(url))
    if (!source) throw new Error('Invalid asset URL.')
    return source.asset(rawUrl)
  }

  private sourceForKey(key: string): NovelSource {
    const id: SourceID = key.startsWith('novelFr:') ? 'novelFr' : 'mangasOrigines'
    const source = this.byID.get(id)
    if (!source) throw new Error(`Source ${id} is unavailable.`)
    return source
  }

  private mergeSeries(
    canonicalKey: string,
    canonicalSource: SourceID,
    values: SourceSeries[],
  ): SourceSeries {
    const ordered = [...values].sort((left, right) => {
      const leftSource = left.sources[0]?.source ?? 'mangasOrigines'
      const rightSource = right.sources[0]?.source ?? 'mangasOrigines'
      return sourceRank(leftSource) - sourceRank(rightSource)
    })
    const preferred = ordered[0]!
    const chapters = new Map<string, SourceChapter>()

    for (const series of ordered) {
      for (const chapter of series.chapters) {
        const identity = chapterIdentity(chapter)
        const existing = chapters.get(identity)
        if (!existing) {
          chapters.set(identity, { ...chapter, releases: sortedReferences(chapter.releases) })
          continue
        }
        const releases = sortedReferences([...existing.releases, ...chapter.releases])
        const canonicalRelease = releases.find((release) => release.source === canonicalSource) ?? releases[0]
        chapters.set(identity, {
          ...existing,
          key: canonicalRelease?.key ?? existing.key,
          title: chapter.releases.some((release) => release.source === 'novelFr') ? chapter.title : existing.title,
          publishedAt: chapter.publishedAt ?? existing.publishedAt,
          releases,
        })
      }
    }

    const mergedChapters = [...chapters.values()].sort((left, right) => {
      if (left.number === null && right.number === null) return left.title.localeCompare(right.title, 'fr')
      if (left.number === null) return 1
      if (right.number === null) return -1
      return right.number - left.number
    })

    return {
      ...preferred,
      key: canonicalKey,
      title: displayTitle(ordered.map((series) => series.title)),
      sources: sortedReferences(ordered.flatMap((series) => series.sources)),
      coverImage: preferred.coverImage ?? ordered.find((series) => series.coverImage)?.coverImage ?? null,
      author: preferred.author ?? ordered.find((series) => series.author)?.author ?? null,
      description: preferred.description ?? ordered.find((series) => series.description)?.description ?? null,
      genres: [...new Set(ordered.flatMap((series) => series.genres))],
      status: preferred.status ?? ordered.find((series) => series.status)?.status ?? null,
      chapters: mergedChapters,
    }
  }
}

export { normalizeTitle }
