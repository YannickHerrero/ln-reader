import * as cheerio from 'cheerio'
import type {
  SourceBrowseResult,
  SourceChapter,
  SourceChapterContent,
  SourceDiscovery,
  SourceSearchResult,
  SourceSeries,
} from '../../shared/contracts'
import { sanitizeChapterHtml } from './parsers'
import type { NovelSource } from './types'

const BASE_URL = 'https://novel-fr.net'
const PREFIX = 'novelFr:'
const USER_AGENT = 'LN Reader/1.0 (+personal reading client)'

interface WordPressSearchResult {
  title?: unknown
  url?: unknown
  subtype?: unknown
}

function sourceKey(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl, BASE_URL)
    if (url.origin !== BASE_URL) return null
    return `${PREFIX}${url.pathname}`
  } catch {
    return null
  }
}

function sourcePath(key: string): string {
  if (!key.startsWith(PREFIX)) throw new Error('Invalid Novel-FR key.')
  const path = key.slice(PREFIX.length)
  if (!path.startsWith('/')) throw new Error('Invalid Novel-FR path.')
  return path
}

function coverUrl(raw: string | undefined): string | null {
  if (!raw) return null
  try {
    const url = new URL(raw, BASE_URL)
    if (url.protocol === 'http:') url.protocol = 'https:'
    return url.toString()
  } catch {
    return null
  }
}

function chapterNumber(label: string): number | null {
  const match = label.match(/\bCh(?:apitre)?\.?\s*(\d+(?:[.,]\d+)?)/i)
    ?? label.match(/chapitre[- ](\d+(?:[.,]\d+)?)/i)
  if (!match?.[1]) return null
  const value = Number(match[1].replace(',', '.'))
  return Number.isFinite(value) ? value : null
}

function parseBrowse(html: string): SourceBrowseResult[] {
  const $ = cheerio.load(html)
  const results: SourceBrowseResult[] = []
  const seen = new Set<string>()

  $('.listupd article').each((_index, item) => {
    const link = $(item).find('h2 a, .mdthumb a').first()
    const key = sourceKey(link.attr('href') ?? '')
    const title = link.text().replace(/\s+/g, ' ').trim() || link.attr('title')?.trim()
    if (!key || !title || seen.has(key)) return
    seen.add(key)
    results.push({
      key,
      title,
      coverImage: coverUrl($(item).find('img').first().attr('data-src') ?? $(item).find('img').first().attr('src')),
      sources: [{ source: 'novelFr', key }],
    })
  })

  return results
}

export class NovelFrSource implements NovelSource {
  readonly id = 'novelFr' as const
  private queue: Promise<unknown> = Promise.resolve()
  private nextRequestAt = 0
  private discoveryCache: { value: SourceDiscovery; expiresAt: number } | null = null

  async search(query: string): Promise<SourceSearchResult[]> {
    const url = new URL('/wp-json/wp/v2/search', BASE_URL)
    url.searchParams.set('search', query)
    url.searchParams.set('per_page', '20')
    const response = await this.request(url.pathname + url.search)
    const decoded = JSON.parse(response.body.toString('utf8')) as WordPressSearchResult[]
    return decoded.flatMap((item) => {
      if (typeof item.title !== 'string' || typeof item.url !== 'string') return []
      const key = sourceKey(item.url)
      const title = cheerio.load(item.title).text().trim()
      return key?.startsWith(`${PREFIX}/series/`) && title ? [{
        key,
        title,
        sourceType: 'text' as const,
        sources: [{ source: 'novelFr' as const, key }],
      }] : []
    })
  }

  async discover(): Promise<SourceDiscovery> {
    if (this.discoveryCache && this.discoveryCache.expiresAt > Date.now()) return this.discoveryCache.value
    const [popular, recentlyAdded, recentlyUpdated] = await Promise.all([
      this.browse('popular'),
      this.browse('latest'),
      this.browse('update'),
    ])
    const value = { popular, recentlyAdded, recentlyUpdated }
    this.discoveryCache = { value, expiresAt: Date.now() + 5 * 60 * 1_000 }
    return value
  }

  async series(key: string): Promise<SourceSeries> {
    const path = sourcePath(key)
    if (!/^\/series\/[^/]+\/$/.test(path)) throw new Error('Invalid Novel-FR series key.')
    const response = await this.request(path)
    const $ = cheerio.load(response.body.toString('utf8'))
    const title = $('h1.entry-title').first().text().replace(/\s+/g, ' ').trim()
    if (!title) throw new Error('Novel-FR returned a series without a title.')

    const chapters: SourceChapter[] = []
    const byNumber = new Map<number, SourceChapter>()
    $('.eplister li a').each((_index, item) => {
      const link = $(item)
      const chapterKey = sourceKey(link.attr('href') ?? '')
      const label = link.find('.epl-num').text().replace(/\s+/g, ' ').trim()
      const number = chapterNumber(label)
      if (!chapterKey || number === null || byNumber.has(number)) return
      const chapterTitle = link.find('.epl-title').text().replace(/\s+/g, ' ').trim()
      const chapter: SourceChapter = {
        key: chapterKey,
        title: chapterTitle ? `Chapitre ${number} · ${chapterTitle}` : `Chapitre ${number}`,
        number,
        publishedAt: link.find('.epl-date').text().replace(/\s+/g, ' ').trim() || null,
        releases: [{ source: 'novelFr', key: chapterKey }],
      }
      byNumber.set(number, chapter)
      chapters.push(chapter)
    })

    // Novel-FR's TBATE index omits old links even though the numbered pages exist.
    // Fill that known continuous run from the source's advertised first/last chapters.
    if (path === '/series/the-beginning-after-the-end/' && byNumber.size > 0) {
      const max = Math.max(...byNumber.keys())
      for (let number = 1; number <= max; number += 1) {
        if (byNumber.has(number)) continue
        const chapterKey = `${PREFIX}/the-beginning-after-the-end-chapitre-${number}/`
        chapters.push({
          key: chapterKey,
          title: `Chapitre ${number}`,
          number,
          publishedAt: null,
          releases: [{ source: 'novelFr', key: chapterKey }],
        })
      }
    }
    chapters.sort((left, right) => (right.number ?? -1) - (left.number ?? -1))

    const author = $('.serl').filter((_index, item) => $(item).find('.sername').text().trim() === 'Auteur')
      .find('.serval').first().text().replace(/\s+/g, ' ').trim() || null

    return {
      key,
      title,
      sources: [{ source: 'novelFr', key }],
      coverImage: coverUrl($('.sertothumb img').first().attr('data-src') ?? $('.sertothumb img').first().attr('src')),
      author,
      description: $('.sersys.entry-content').first().text().replace(/\s+/g, ' ').trim() || null,
      genres: $('.sertogenre a').map((_index, item) => $(item).text().trim()).get().filter(Boolean),
      status: $('.sertostat span').first().text().replace(/\s+/g, ' ').trim() || null,
      chapters,
    }
  }

  async chapter(key: string): Promise<SourceChapterContent> {
    const path = sourcePath(key)
    if (!/^\/[^/]+\/$/.test(path)) throw new Error('Invalid Novel-FR chapter key.')
    const response = await this.request(path)
    const $ = cheerio.load(response.body.toString('utf8'))
    const title = $('h1.entry-title').first().text().replace(/\s+/g, ' ').trim() || 'Chapitre'
    const html = sanitizeChapterHtml($('.entry-content.epcontent').first().html() ?? '')
    if (!html) throw new Error('Novel-FR returned an empty chapter.')
    return { key, title, html, source: 'novelFr' }
  }

  ownsAsset(url: URL): boolean {
    if (url.origin === BASE_URL) return url.pathname.startsWith('/wp-content/uploads/')
    return /^i\d+\.wp\.com$/.test(url.hostname)
      && url.pathname.startsWith('/novel-fr.net/wp-content/uploads/')
  }

  async asset(rawUrl: string): Promise<{ body: Buffer; contentType: string }> {
    const url = new URL(rawUrl)
    if (!this.ownsAsset(url)) throw new Error('Invalid Novel-FR asset URL.')
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
    if (!response.ok) throw new Error(`Novel-FR asset returned HTTP ${response.status}.`)
    const contentType = response.headers.get('content-type') ?? 'application/octet-stream'
    if (!contentType.startsWith('image/')) throw new Error('Novel-FR returned a non-image asset.')
    return { body: Buffer.from(await response.arrayBuffer()), contentType }
  }

  private browse(order: 'popular' | 'latest' | 'update'): Promise<SourceBrowseResult[]> {
    return this.request(`/series/?status=&type=&order=${order}`)
      .then((response) => parseBrowse(response.body.toString('utf8')))
  }

  private request(path: string): Promise<{ body: Buffer }> {
    const operation = this.queue.then(async () => {
      const delay = Math.max(0, this.nextRequestAt - Date.now())
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay))
      this.nextRequestAt = Date.now() + 500
      const response = await fetch(new URL(path, BASE_URL), { headers: { 'User-Agent': USER_AGENT } })
      if (!response.ok) throw new Error(`Novel-FR returned HTTP ${response.status}.`)
      return { body: Buffer.from(await response.arrayBuffer()) }
    })
    this.queue = operation.catch(() => undefined)
    return operation
  }
}

export { BASE_URL as NOVEL_FR_BASE_URL, PREFIX as NOVEL_FR_PREFIX }
