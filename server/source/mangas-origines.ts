import type {
  SourceBrowseResult,
  SourceChapterContent,
  SourceDiscovery,
  SourceSearchResult,
  SourceSeries,
} from '../../shared/contracts'
import {
  BASE_URL,
  parseBrowseResults,
  parseChapterContent,
  parseSearchResponse,
  parseSeriesDetails,
} from './parsers'
import type { SourceHttpClient, SourceService } from './types'

const textDecoder = new TextDecoder()

function assertSourcePath(key: string, kind: 'series' | 'chapter'): string {
  const url = new URL(key, BASE_URL)
  const isSeries = /^\/oeuvre\/[^/]+\/$/.test(url.pathname)
  const isChapter = /^\/oeuvre\/[^/]+\/[^/]+\/$/.test(url.pathname)
  if (url.origin !== BASE_URL || (kind === 'series' ? !isSeries : !isChapter)) {
    throw new Error(`Invalid ${kind} key.`)
  }
  return url.pathname
}

export class MangasOriginesSource implements SourceService {
  private discoveryCache: { value: SourceDiscovery; expiresAt: number } | null = null

  constructor(private readonly client: SourceHttpClient) {}

  async search(query: string): Promise<SourceSearchResult[]> {
    const body = new URLSearchParams({
      action: 'wp-manga-search-manga',
      title: query,
    }).toString()
    const response = await this.client.request('/wp-admin/admin-ajax.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body,
    })
    if (response.status !== 200) throw new Error(`Search returned HTTP ${response.status}.`)

    return parseSearchResponse(JSON.parse(textDecoder.decode(response.body)) as unknown)
  }

  async discover(): Promise<SourceDiscovery> {
    if (this.discoveryCache && this.discoveryCache.expiresAt > Date.now()) {
      return this.discoveryCache.value
    }

    const value = {
      popular: await this.browse('popular'),
      recentlyAdded: await this.browse('added'),
      recentlyUpdated: await this.browse('updated'),
    }
    this.discoveryCache = { value, expiresAt: Date.now() + 5 * 60 * 1_000 }
    return value
  }

  async series(key: string): Promise<SourceSeries> {
    const path = assertSourcePath(key, 'series')
    const detailResponse = await this.client.request(path)
    if (detailResponse.status !== 200) throw new Error(`Series returned HTTP ${detailResponse.status}.`)

    const chaptersResponse = await this.client.request(`${path}ajax/chapters`, {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    })
    const detailHtml = textDecoder.decode(detailResponse.body)
    const chaptersHtml = chaptersResponse.status === 200 && chaptersResponse.body.length > 0
      ? textDecoder.decode(chaptersResponse.body)
      : detailHtml

    return parseSeriesDetails(detailHtml, path, chaptersHtml)
  }

  async chapter(key: string): Promise<SourceChapterContent> {
    const path = assertSourcePath(key, 'chapter')
    const response = await this.client.request(path)
    if (response.status !== 200) throw new Error(`Chapter returned HTTP ${response.status}.`)
    return parseChapterContent(textDecoder.decode(response.body), path)
  }

  private async browse(sort: 'popular' | 'added' | 'updated'): Promise<SourceBrowseResult[]> {
    const form = new URLSearchParams({
      action: 'madara_load_more',
      page: '0',
      template: 'madara-core/content/content-archive',
      'vars[paged]': '1',
      'vars[post_type]': 'wp-manga',
      'vars[post_status]': 'publish',
      'vars[meta_query][0][key]': '_wp_manga_chapter_type',
      'vars[meta_query][0][value]': 'text',
      'vars[order]': 'DESC',
      'vars[sidebar]': 'right',
      'vars[manga_archives_item_layout]': 'big_thumbnail',
    })
    if (sort === 'popular') {
      form.set('vars[orderby]', 'meta_value_num')
      form.set('vars[meta_key]', '_wp_manga_views')
    } else if (sort === 'updated') {
      form.set('vars[orderby]', 'meta_value_num')
      form.set('vars[meta_key]', '_latest_update')
    } else {
      form.set('vars[orderby]', 'date')
    }

    const response = await this.client.request('/wp-admin/admin-ajax.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: form.toString(),
    })
    if (response.status !== 200) throw new Error(`Discovery returned HTTP ${response.status}.`)
    return parseBrowseResults(textDecoder.decode(response.body))
  }

  async asset(rawUrl: string): Promise<{ body: Buffer; contentType: string }> {
    const url = new URL(rawUrl)
    if (url.origin !== BASE_URL || !url.pathname.startsWith('/wp-content/uploads/')) {
      throw new Error('Invalid asset URL.')
    }
    const response = await this.client.request(`${url.pathname}${url.search}`, { pace: false })
    if (response.status !== 200 || !response.contentType.startsWith('image/')) {
      throw new Error(`Asset returned HTTP ${response.status}.`)
    }
    return { body: response.body, contentType: response.contentType }
  }
}
