/**
 * EPUB Processor
 * Pre-processes EPUB files at import time for instant reading
 */

import { loadEpubBook, type Epub } from 'epubix'
import { countHtmlCharacters } from '@/lib/pagination/get-character-count'
import type { ProcessedChapter } from '@/lib/db/types'

/** Prefix for dummy image URLs in stored HTML */
const DUMMY_IMG_PREFIX = 'DUMMY_IMG:'

/** MIME types for image extensions */
const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
}

export interface ProcessedEpubData {
  metadata: {
    title: string
    author: string
    language?: string
    coverUrl: string | null
  }
  chapters: ProcessedChapter[]
  styleSheet: string
  blobs: Record<string, Blob>
  chapterCharCounts: number[]
  totalCharCount: number
}

/**
 * Process an EPUB file for storage
 * Extracts and processes all content at import time
 */
export async function processEpub(file: File): Promise<ProcessedEpubData> {
  const epub = await loadEpubBook(file)

  // 1. Extract image blobs from EPUB
  const blobs = await extractImageBlobs(epub)

  // 2. Extract and scope CSS
  const styleSheet = await extractAndScopeCSS(epub)

  // 3. Process each chapter's HTML
  const chapters = processChapters(epub)

  // 4. Get cover image
  const coverUrl = await epub.getCoverImageData()

  // 5. Calculate character counts
  const chapterCharCounts = chapters.map((ch) => ch.charCount)
  const totalCharCount = chapterCharCounts.reduce((sum, c) => sum + c, 0)

  return {
    metadata: {
      title: epub.metadata?.title || file.name.replace(/\.epub$/i, ''),
      author: epub.metadata?.author || 'Unknown Author',
      language: epub.metadata?.language,
      coverUrl,
    },
    chapters,
    styleSheet,
    blobs,
    chapterCharCounts,
    totalCharCount,
  }
}

/**
 * Resolves a relative path from within an EPUB chapter to an absolute path
 */
function resolveEpubPath(chapterHref: string, relativePath: string): string {
  const chapterDir = chapterHref.substring(0, chapterHref.lastIndexOf('/') + 1)

  if (relativePath.startsWith('../')) {
    const parts = chapterDir.split('/').filter(Boolean)
    const relParts = relativePath.split('/')

    let upCount = 0
    for (const part of relParts) {
      if (part === '..') upCount++
      else break
    }

    const baseParts = parts.slice(0, -upCount)
    const remainingParts = relParts.slice(upCount)

    return [...baseParts, ...remainingParts].join('/')
  }

  if (relativePath.startsWith('./')) {
    return chapterDir + relativePath.substring(2)
  }

  if (relativePath.startsWith('/')) {
    return relativePath.substring(1)
  }

  return chapterDir + relativePath
}

/**
 * Extract all image blobs from the EPUB
 */
async function extractImageBlobs(epub: Epub): Promise<Record<string, Blob>> {
  const blobs: Record<string, Blob> = {}

  if (!epub.resources) return blobs

  for (const path of Object.keys(epub.resources)) {
    // Check if it's an image file
    const ext = path.split('.').pop()?.toLowerCase()
    if (!ext || !MIME_TYPES[ext]) continue

    try {
      const data = await epub.getFile(path)
      if (data) {
        blobs[path] = new Blob([data], { type: MIME_TYPES[ext] })
      }
    } catch {
      // Skip if file can't be loaded
    }
  }

  return blobs
}

/**
 * Extract CSS from EPUB and scope it under .book-content
 */
async function extractAndScopeCSS(epub: Epub): Promise<string> {
  const styles: string[] = []

  if (!epub.resources) return ''

  for (const [path] of Object.entries(epub.resources)) {
    if (!path.endsWith('.css')) continue

    try {
      const data = await epub.getFile(path)
      if (data) {
        const css = new TextDecoder().decode(data)
        styles.push(css)
      }
    } catch {
      // Skip if CSS file can't be loaded
    }
  }

  if (styles.length === 0) return ''

  // Scope all CSS under .book-content-container
  return scopeCSS(styles.join('\n'), '.book-content-container')
}

/**
 * Scope CSS selectors under a parent selector
 * Simple implementation that handles most common cases
 */
function scopeCSS(css: string, parentSelector: string): string {
  // Remove @import statements (not supported in scoped context)
  css = css.replace(/@import[^;]+;/g, '')

  // Remove @charset statements
  css = css.replace(/@charset[^;]+;/g, '')

  // Split into rules (simple approach - handles most cases)
  const lines = css.split('\n')
  const result: string[] = []
  let inRule = false
  let currentSelector = ''
  let braceCount = 0

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip empty lines
    if (!trimmed) continue

    // Handle @media, @keyframes, etc. - pass through as-is
    if (trimmed.startsWith('@media') || trimmed.startsWith('@keyframes') || trimmed.startsWith('@font-face')) {
      result.push(line)
      if (trimmed.includes('{')) braceCount++
      continue
    }

    // Count braces
    const openBraces = (trimmed.match(/{/g) || []).length
    const closeBraces = (trimmed.match(/}/g) || []).length
    braceCount += openBraces - closeBraces

    // If we're inside @media or @keyframes, pass through
    if (braceCount > 1) {
      result.push(line)
      continue
    }

    // Check if this line contains a selector (has { but isn't just })
    if (trimmed.includes('{') && !trimmed.startsWith('}')) {
      // Extract selector part
      const selectorPart = trimmed.split('{')[0].trim()

      // Skip html, body, :root selectors
      if (/^(html|body|:root)\s*$/.test(selectorPart)) {
        inRule = true
        currentSelector = selectorPart
        continue
      }

      // Scope the selector
      const scopedSelectors = selectorPart
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s && !['html', 'body', ':root'].includes(s))
        .map((s) => `${parentSelector} ${s}`)
        .join(', ')

      if (scopedSelectors) {
        const rest = trimmed.substring(trimmed.indexOf('{'))
        result.push(`${scopedSelectors} ${rest}`)
      }
      inRule = true
      continue
    }

    // If we're in a skipped rule (html/body), skip until closing brace
    if (inRule && ['html', 'body', ':root'].includes(currentSelector)) {
      if (trimmed === '}') {
        inRule = false
        currentSelector = ''
      }
      continue
    }

    result.push(line)

    if (trimmed === '}') {
      inRule = false
      currentSelector = ''
    }
  }

  return result.join('\n')
}

/**
 * Process all chapters, replacing image URLs with dummy placeholders
 */
function processChapters(epub: Epub): ProcessedChapter[] {
  const chapters: ProcessedChapter[] = []

  for (const chapter of epub.chapters || []) {
    const parser = new DOMParser()
    const doc = parser.parseFromString(chapter.content, 'text/html')

    // Replace <img> src with dummy URLs
    for (const img of doc.querySelectorAll('img')) {
      const src = img.getAttribute('src')
      if (src && !src.startsWith('data:')) {
        const resolvedPath = resolveEpubPath(chapter.href, src)
        img.setAttribute('src', `${DUMMY_IMG_PREFIX}${resolvedPath}`)
      }
    }

    // Replace SVG <image> href with dummy URLs
    for (const img of doc.querySelectorAll('image')) {
      const src = img.getAttribute('xlink:href') || img.getAttribute('href')
      if (src && !src.startsWith('data:')) {
        const resolvedPath = resolveEpubPath(chapter.href, src)
        img.removeAttribute('xlink:href')
        img.setAttribute('href', `${DUMMY_IMG_PREFIX}${resolvedPath}`)
      }
    }

    const html = doc.body.innerHTML
    const charCount = countHtmlCharacters(html)

    chapters.push({
      id: chapter.href,
      html,
      charCount,
      title: chapter.title,
    })
  }

  return chapters
}

/**
 * Convert dummy image URLs to blob URLs at read time
 */
export function replaceDummyUrls(
  html: string,
  blobUrls: Map<string, string>
): string {
  let result = html
  for (const [path, url] of blobUrls) {
    result = result.replaceAll(`${DUMMY_IMG_PREFIX}${path}`, url)
  }
  return result
}

/**
 * Create Object URLs from stored blobs
 */
export function createBlobUrls(blobs: Record<string, Blob>): Map<string, string> {
  const urls = new Map<string, string>()
  for (const [path, blob] of Object.entries(blobs)) {
    urls.set(path, URL.createObjectURL(blob))
  }
  return urls
}

/**
 * Revoke all Object URLs to free memory
 */
export function revokeBlobUrls(urls: Map<string, string>): void {
  for (const url of urls.values()) {
    URL.revokeObjectURL(url)
  }
}
