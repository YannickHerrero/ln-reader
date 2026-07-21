import * as cheerio from 'cheerio'
import sanitizeHtml from 'sanitize-html'
import type {
  SourceChapter,
  SourceChapterContent,
  SourceSearchResult,
  SourceSeries,
} from '../../shared/contracts'
import { decryptChapter } from './chapter-decryption'

const BASE_URL = 'https://mangas-origines.fr'

interface SearchSuggestion {
  title?: unknown
  url?: unknown
  type?: unknown
}

function sourceKey(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl, BASE_URL)
    if (url.origin !== BASE_URL) return null
    return `${url.pathname}${url.search}`
  } catch {
    return null
  }
}

function imageUrl(element: { attr(name: string): string | undefined }): string | null {
  for (const attribute of ['data-src', 'data-lazy-src', 'data-cfsrc', 'data-manga-src', 'src']) {
    const value = element.attr(attribute)?.trim()
    if (value && !value.startsWith('data:')) return new URL(value, BASE_URL).toString()
  }

  const srcset = element.attr('data-srcset') ?? element.attr('srcset')
  const candidate = srcset?.split(',').at(-1)?.trim().split(/\s+/)[0]
  return candidate ? new URL(candidate, BASE_URL).toString() : null
}

function itemValue(
  $: cheerio.CheerioAPI,
  headingPattern: RegExp,
): string | null {
  let result: string | null = null
  $('.post-content_item').each((_index, item) => {
    const heading = $(item).find('.summary-heading, h5').first().text().replace(/\s+/g, ' ').trim()
    if (headingPattern.test(heading)) {
      result = $(item).find('.summary-content').first().text().replace(/\s+/g, ' ').trim() || null
      return false
    }
    return undefined
  })
  return result
}

export function parseSearchResponse(value: unknown): SourceSearchResult[] {
  if (!value || typeof value !== 'object') return []
  const data = (value as { data?: unknown }).data
  if (!Array.isArray(data)) return []

  const seen = new Set<string>()
  return (data as SearchSuggestion[]).flatMap((suggestion) => {
    if (suggestion.type !== 'text' || typeof suggestion.title !== 'string' || typeof suggestion.url !== 'string') {
      return []
    }
    const key = sourceKey(suggestion.url)
    if (!key || seen.has(key)) return []
    seen.add(key)
    return [{ key, title: suggestion.title.trim(), sourceType: 'text' as const }]
  })
}

export function parseChapters(html: string): SourceChapter[] {
  const $ = cheerio.load(html)
  const chapters: SourceChapter[] = []
  const seen = new Set<string>()

  $('li.wp-manga-chapter').each((_index, item) => {
    const link = $(item).find('a').first()
    const key = sourceKey(link.attr('href') ?? '')
    const title = link.text().replace(/\s+/g, ' ').trim()
    if (!key || !title || seen.has(key)) return

    const numberMatch = title.match(/[0-9]+(?:[.,][0-9]+)?/)
    const number = numberMatch ? Number(numberMatch[0].replace(',', '.')) : null
    const publishedAt = $(item).find('.chapter-release-date').first().text().replace(/\s+/g, ' ').trim() || null
    seen.add(key)
    chapters.push({ key, title, number: Number.isFinite(number) ? number : null, publishedAt })
  })

  return chapters
}

export function parseSeriesDetails(
  html: string,
  key: string,
  chaptersHtml = html,
): SourceSeries {
  const $ = cheerio.load(html)
  const title = $('.post-title h1, .post-title h3, #manga-title h1').first().text().replace(/\s+/g, ' ').trim()
  if (!title) throw new Error('The source returned a series without a title.')

  const coverElement = $('.summary_image img').first()
  const description = $('.description-summary .summary__content, .summary__content').first().text().replace(/\s+/g, ' ').trim() || null
  const author = $('.author-content a, .manga-authors a').map((_index, item) => $(item).text().trim()).get().filter(Boolean).join(', ') || null
  const genres = $('.genres-content a').map((_index, item) => $(item).text().trim()).get().filter(Boolean)

  return {
    key,
    title,
    coverImage: coverElement.length ? imageUrl(coverElement) : null,
    author,
    description,
    genres: [...new Set(genres)],
    status: itemValue($, /^(état|status)/i),
    chapters: parseChapters(chaptersHtml),
  }
}

const allowedTags = ['p', 'br', 'strong', 'em', 'b', 'i', 'blockquote', 'hr', 'ul', 'ol', 'li', 'h2', 'h3']

export function parseChapterContent(html: string, key: string): SourceChapterContent {
  const $ = cheerio.load(html)
  const title = $('#chapter-heading').first().text().replace(/\s+/g, ' ').trim()
    || $('.c-breadcrumb .active').first().text().replace(/\s+/g, ' ').trim()
    || 'Chapitre'
  const protectedContainer = $('.chapter-content-protected').first()

  let chapterHtml: string
  if (protectedContainer.length) {
    const encrypted = protectedContainer.attr('data-enc')
    const iv = protectedContainer.attr('data-iv')
    const tag = protectedContainer.attr('data-tag')
    const token = protectedContainer.attr('data-token')
    if (!encrypted || !iv || !tag || !token) {
      throw new Error('The protected chapter data is incomplete.')
    }
    chapterHtml = decryptChapter({ encrypted, iv, tag, token })
  } else {
    chapterHtml = $('.reading-content .text-left').first().html() ?? ''
  }

  const sanitized = sanitizeHtml(chapterHtml, {
    allowedTags,
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
  }).trim()
  if (!sanitized) throw new Error('The source returned an empty chapter.')

  return { key, title, html: sanitized }
}

export { BASE_URL }
