import type { Epub } from 'epubix'

/**
 * Resolves a relative path from within an EPUB chapter to an absolute path
 */
function resolveEpubPath(chapterHref: string, relativePath: string): string {
  // Get the directory of the chapter
  const chapterDir = chapterHref.substring(0, chapterHref.lastIndexOf('/') + 1)

  // Handle relative paths
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
 * Process chapter HTML to replace image sources with blob URLs
 */
export async function processChapterContent(
  html: string,
  epub: Epub,
  chapterHref: string
): Promise<{ html: string; blobUrls: string[] }> {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const blobUrls: string[] = []

  const mimeTypes: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
  }

  async function processImageSrc(src: string): Promise<string | null> {
    if (!src || src.startsWith('data:') || src.startsWith('blob:')) {
      return null
    }

    try {
      const resolvedPath = resolveEpubPath(chapterHref, src)
      const data = await epub.getFile(resolvedPath)

      if (data) {
        const ext = src.split('.').pop()?.toLowerCase() || 'png'
        const mimeType = mimeTypes[ext] || 'image/png'
        const blob = new Blob([data], { type: mimeType })
        const blobUrl = URL.createObjectURL(blob)
        blobUrls.push(blobUrl)
        return blobUrl
      }
    } catch (error) {
      console.warn(`Failed to load image: ${src}`, error)
    }
    return null
  }

  // Process <img> elements
  const images = doc.querySelectorAll('img')
  for (const img of images) {
    const src = img.getAttribute('src')
    if (src) {
      const blobUrl = await processImageSrc(src)
      if (blobUrl) {
        img.src = blobUrl
      }
    }
  }

  // Process SVG <image> elements (xlink:href or href)
  const svgImages = doc.querySelectorAll('image')
  for (const img of svgImages) {
    const src = img.getAttribute('xlink:href') || img.getAttribute('href')
    if (src) {
      const blobUrl = await processImageSrc(src)
      if (blobUrl) {
        img.removeAttribute('xlink:href')
        img.setAttribute('href', blobUrl)
      }
    }
  }

  return { html: doc.body.innerHTML, blobUrls }
}

/**
 * Clean up blob URLs to prevent memory leaks
 */
export function revokeBlobUrls(urls: string[]): void {
  for (const url of urls) {
    URL.revokeObjectURL(url)
  }
}

/**
 * Extract and process CSS from the EPUB
 */
export async function extractEpubStyles(epub: Epub): Promise<string> {
  const styles: string[] = []

  // Try to get CSS files from resources
  if (epub.resources) {
    for (const [path, resource] of Object.entries(epub.resources)) {
      if (path.endsWith('.css') && resource) {
        try {
          const data = await epub.getFile(path)
          if (data) {
            const decoder = new TextDecoder()
            const css = decoder.decode(data)
            styles.push(css)
          }
        } catch {
          // Skip if CSS file can't be loaded
        }
      }
    }
  }

  return styles.join('\n')
}
