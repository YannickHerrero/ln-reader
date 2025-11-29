'use client'

export interface WordSelection {
  word: string
  sentence: string
}

/**
 * Get the word at a specific character index using Intl.Segmenter
 * Handles Japanese text segmentation properly
 */
export function getWordAtPosition(text: string, charIndex: number): string {
  if (!text || charIndex < 0 || charIndex >= text.length) {
    return ''
  }

  // Use Intl.Segmenter for Japanese word boundaries
  const segmenter = new Intl.Segmenter('ja', { granularity: 'word' })
  const segments = Array.from(segmenter.segment(text))

  let currentIndex = 0
  for (const segment of segments) {
    const segmentEnd = currentIndex + segment.segment.length
    if (charIndex >= currentIndex && charIndex < segmentEnd) {
      // Skip if it's just whitespace or punctuation
      if (segment.isWordLike) {
        return segment.segment
      }
      return ''
    }
    currentIndex = segmentEnd
  }

  return ''
}

/**
 * Get the sentence containing a specific character index
 * Handles both Japanese and Western sentence boundaries
 */
export function getSentenceAtPosition(text: string, charIndex: number): string {
  if (!text || charIndex < 0 || charIndex >= text.length) {
    return ''
  }

  // Use Intl.Segmenter for sentence boundaries
  const segmenter = new Intl.Segmenter('ja', { granularity: 'sentence' })
  const segments = Array.from(segmenter.segment(text))

  let currentIndex = 0
  for (const segment of segments) {
    const segmentEnd = currentIndex + segment.segment.length
    if (charIndex >= currentIndex && charIndex < segmentEnd) {
      return segment.segment.trim()
    }
    currentIndex = segmentEnd
  }

  return text.trim()
}

/**
 * Get the text content of an element, excluding ruby annotations (rt elements)
 * This gives us the base text without furigana readings
 */
function getTextWithoutRuby(element: Element): string {
  let text = ''
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      // Skip text nodes inside <rt> elements (furigana readings)
      const parent = node.parentElement
      if (parent?.tagName === 'RT') {
        return NodeFilter.FILTER_REJECT
      }
      return NodeFilter.FILTER_ACCEPT
    },
  })

  let node = walker.nextNode()
  while (node) {
    text += node.textContent || ''
    node = walker.nextNode()
  }

  return text
}

/**
 * Find the character offset of a text node within a parent element,
 * excluding text inside <rt> elements (furigana)
 */
function findNodeOffsetWithoutRuby(parent: Element, targetNode: Node): number {
  const walker = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      // Skip text nodes inside <rt> elements
      const nodeParent = node.parentElement
      if (nodeParent?.tagName === 'RT') {
        return NodeFilter.FILTER_REJECT
      }
      return NodeFilter.FILTER_ACCEPT
    },
  })

  let offset = 0
  let node = walker.nextNode()

  while (node) {
    if (node === targetNode) {
      return offset
    }
    offset += node.textContent?.length || 0
    node = walker.nextNode()
  }

  return -1
}

/**
 * Find the parent element suitable for word segmentation
 * (paragraph or block element)
 */
function findBlockParent(node: Node): Element | null {
  let parent = node.parentElement
  const blockTags = ['P', 'DIV', 'LI', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']

  while (parent && !blockTags.includes(parent.tagName)) {
    parent = parent.parentElement
  }

  return parent
}

/**
 * Get the full word from the parent element context
 * This handles ruby/furigana text where each kanji might be in separate elements
 */
function getWordFromParentContext(textNode: Node, offset: number): string {
  const parent = findBlockParent(textNode)

  if (!parent) {
    // Fallback to just the text node content
    const text = textNode.textContent || ''
    return getWordAtPosition(text, offset)
  }

  // Get full text excluding furigana
  const fullText = getTextWithoutRuby(parent)

  // Find where our clicked character is in the full text
  const nodeOffset = findNodeOffsetWithoutRuby(parent, textNode)

  if (nodeOffset === -1) {
    // Fallback
    const text = textNode.textContent || ''
    return getWordAtPosition(text, offset)
  }

  const absoluteOffset = nodeOffset + offset
  return getWordAtPosition(fullText, absoluteOffset)
}

/**
 * Get the full sentence from the parent paragraph element
 */
function getSentenceFromParentContext(textNode: Node, offset: number): string {
  const parent = findBlockParent(textNode)

  if (!parent) {
    const text = textNode.textContent || ''
    return getSentenceAtPosition(text, offset)
  }

  // For sentences, we include the furigana in the display
  // but use the base text for finding sentence boundaries
  const fullText = getTextWithoutRuby(parent)
  const nodeOffset = findNodeOffsetWithoutRuby(parent, textNode)

  if (nodeOffset === -1) {
    const text = textNode.textContent || ''
    return getSentenceAtPosition(text, offset)
  }

  const absoluteOffset = nodeOffset + offset
  return getSentenceAtPosition(fullText, absoluteOffset)
}

/**
 * Get the word and sentence that was clicked using caretRangeFromPoint
 */
export function getClickedWordAndSentence(clientX: number, clientY: number): WordSelection | null {
  // Use caretRangeFromPoint to find the text position
  const range = document.caretRangeFromPoint(clientX, clientY)
  if (!range) return null

  const textNode = range.startContainer
  if (textNode.nodeType !== Node.TEXT_NODE) return null

  // Check if we clicked on furigana (rt element) - if so, ignore
  const parent = textNode.parentElement
  if (parent?.tagName === 'RT') {
    return null
  }

  const offset = range.startOffset

  // Get word using parent context (handles ruby/furigana)
  const word = getWordFromParentContext(textNode, offset)
  if (!word) return null

  const sentence = getSentenceFromParentContext(textNode, offset)

  return { word, sentence }
}

/**
 * Check if a click event target is on text content (not background)
 */
export function isClickOnText(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false

  // Check if we're inside reader content container
  const readerContent = target.closest('.reader-content, .book-content-container')
  if (!readerContent) return false

  // If clicked directly on the container div itself (background), return false
  // Only return true if clicked on actual content elements
  const tagName = target.tagName.toLowerCase()
  const textTags = ['p', 'span', 'a', 'em', 'strong', 'ruby', 'rt', 'rb', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote']

  return textTags.includes(tagName) || target.closest('p, span, a, ruby') !== null
}
