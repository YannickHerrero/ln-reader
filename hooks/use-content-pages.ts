'use client'

import { useMemo } from 'react'

export interface PageContent {
  type: 'text' | 'image'
  content: string
}

/**
 * Count visible characters in an element, excluding furigana (<rt>) content
 */
function countVisibleChars(element: Element): number {
  let count = 0
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  let node: Text | null
  while ((node = walker.nextNode() as Text)) {
    // Skip text inside <rt> elements (furigana)
    if (!node.parentElement?.closest('rt')) {
      count += node.textContent?.length || 0
    }
  }
  return count
}

/**
 * Split HTML content into pages for vertical-rl reading mode.
 * Uses character-based calculation since Japanese characters have uniform width.
 */
export function splitContentIntoPages(
  html: string,
  fontSize: number,
  lineHeight: number,
  containerWidth: number,
  containerHeight: number
): PageContent[] {
  // In vertical-rl mode:
  // - Text flows top-to-bottom (characters stack vertically)
  // - Lines/columns flow right-to-left
  const charsPerColumn = Math.floor(containerHeight / fontSize)
  // TODO: Testing with 2 columns per page - revert after testing
  const columnsPerPage = 2 // Math.floor(containerWidth / (fontSize * lineHeight))
  const charsPerPage = charsPerColumn * columnsPerPage

  console.log('[splitContentIntoPages] Calculation:', {
    containerWidth,
    containerHeight,
    fontSize,
    lineHeight,
    charsPerColumn,
    columnsPerPage,
    charsPerPage,
    htmlLength: html?.length,
  })

  // Parse HTML - need to run in browser
  if (typeof window === 'undefined') {
    return [{ type: 'text', content: html }]
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // Get content elements - unwrap if content is inside a single wrapper div
  let children = Array.from(doc.body.children)

  // If there's only one child and it's a DIV, get its children instead
  if (children.length === 1 && children[0].tagName === 'DIV') {
    children = Array.from(children[0].children)
  }

  console.log('[splitContentIntoPages] Parsed:', {
    childrenCount: children.length,
    firstChildTag: children[0]?.tagName,
    childTags: children.slice(0, 5).map(c => c.tagName),
  })

  const pages: PageContent[] = []
  let currentChars = 0
  let currentElements: string[] = []

  function flushPage() {
    if (currentElements.length > 0) {
      pages.push({ type: 'text', content: currentElements.join('') })
      currentElements = []
      currentChars = 0
    }
  }

  // Process each top-level element
  for (const child of children) {
    // Images become full pages
    if (child.tagName === 'IMG') {
      flushPage()
      pages.push({ type: 'image', content: child.outerHTML })
      continue
    }

    // Count visible text characters (excluding furigana)
    const textLength = countVisibleChars(child)

    // If adding this element would exceed page capacity, start new page
    if (currentChars + textLength > charsPerPage && currentElements.length > 0) {
      flushPage()
    }

    currentElements.push(child.outerHTML)
    currentChars += textLength
  }

  // Flush any remaining content
  flushPage()

  console.log('[splitContentIntoPages] Result:', {
    totalPages: pages.length,
    pageTypes: pages.map(p => p.type),
  })

  return pages.length > 0 ? pages : [{ type: 'text', content: html }]
}

/**
 * Hook to split content into pages for carousel-based reading
 */
export function useContentPages(
  content: string | null,
  fontSize: number,
  lineHeight: number,
  containerWidth: number,
  containerHeight: number
): PageContent[] {
  return useMemo(() => {
    console.log('[useContentPages] Input:', {
      hasContent: !!content,
      contentLength: content?.length,
      containerWidth,
      containerHeight,
    })

    if (!content || containerWidth <= 0 || containerHeight <= 0) {
      console.log('[useContentPages] Skipping - invalid input')
      return []
    }

    return splitContentIntoPages(
      content,
      fontSize,
      lineHeight,
      containerWidth,
      containerHeight
    )
  }, [content, fontSize, lineHeight, containerWidth, containerHeight])
}
