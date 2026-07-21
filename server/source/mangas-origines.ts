import type {
  SourceChapterContent,
  SourceSearchResult,
  SourceSeries,
} from '../../shared/contracts'
import { BASE_URL, parseChapterContent, parseSearchResponse, parseSeriesDetails } from './parsers'
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

  async asset(rawUrl: string): Promise<{ body: Buffer; contentType: string }> {
    const url = new URL(rawUrl)
    if (url.origin !== BASE_URL || !url.pathname.startsWith('/wp-content/uploads/')) {
      throw new Error('Invalid asset URL.')
    }
    const response = await this.client.request(`${url.pathname}${url.search}`)
    if (response.status !== 200 || !response.contentType.startsWith('image/')) {
      throw new Error(`Asset returned HTTP ${response.status}.`)
    }
    return { body: response.body, contentType: response.contentType }
  }
}
