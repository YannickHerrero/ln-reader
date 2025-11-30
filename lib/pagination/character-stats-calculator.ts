/**
 * Character Statistics Calculator
 * Maps scroll positions to character counts for accurate progress tracking
 * Adapted from TTU Ebook Reader
 */

import { binarySearchNoNegative } from './binary-search'
import { getCharacterCount } from './get-character-count'
import { getParagraphNodes } from './get-paragraph-nodes'

/**
 * Format position based on text direction
 */
function formatPos(position: number, direction: 'ltr' | 'rtl'): number {
  return direction === 'rtl' ? -position : position
}

/**
 * Get bounding rect for a node using Range
 */
function getNodeBoundingRect(document: Document, node: Node): DOMRect {
  const range = document.createRange()
  range.selectNode(node)
  return range.getBoundingClientRect()
}

export class CharacterStatsCalculator {
  /** Total character count in content */
  readonly charCount: number

  /** Accumulated character count at each paragraph */
  readonly accumulatedCharCount: number[]

  /** Scroll position for each paragraph */
  readonly paragraphPos: number[]

  /** All paragraph/text nodes */
  private readonly paragraphs: Node[]

  /** Map from scroll position to accumulated char count */
  private paragraphPosToAccCharCount = new Map<number, number>()

  constructor(
    public readonly containerEl: HTMLElement,
    private readonly axis: 'horizontal' | 'vertical',
    public readonly direction: 'ltr' | 'rtl',
    private readonly scrollEl: HTMLElement,
    private readonly document: Document = window.document
  ) {
    // Get all text/paragraph nodes
    this.paragraphs = getParagraphNodes(containerEl)

    // Initialize arrays
    this.paragraphPos = new Array(this.paragraphs.length)
    this.accumulatedCharCount = []

    // Calculate accumulated character counts
    let exploredCharCount = 0
    for (const node of this.paragraphs) {
      exploredCharCount += getCharacterCount(node)
      this.accumulatedCharCount.push(exploredCharCount)
    }
    this.charCount = exploredCharCount
  }

  get verticalMode(): boolean {
    return this.axis === 'vertical'
  }

  /**
   * Update all paragraph positions based on current scroll position
   * This maps each paragraph to its scroll position
   */
  updateParagraphPos(scrollPos = 0): void {
    const scrollElRect = this.scrollEl.getBoundingClientRect()
    const scrollElRight = formatPos(
      this.verticalMode ? scrollElRect.right : scrollElRect.top,
      this.direction
    )

    const dimensionAdjustment = Number(
      getComputedStyle(this.containerEl)[
        this.verticalMode ? 'paddingRight' : 'paddingTop'
      ].replace(/px$/, '')
    )

    const paragraphPosToIndices = new Map<number, number[]>()

    for (let i = 0; i < this.paragraphs.length; i += 1) {
      const node = this.paragraphs[i]
      const nodeRect = getNodeBoundingRect(this.document, node)

      const getParagraphPos = (): number => {
        const paragraphSize = this.verticalMode ? nodeRect.width : nodeRect.height
        if (paragraphSize <= 0) {
          // Node is off-screen or has no size, use previous node's position
          return this.paragraphPos[i - 1] || 0
        }
        const nodeLeft = formatPos(
          this.verticalMode ? nodeRect.left : nodeRect.bottom,
          this.direction
        )
        return nodeLeft - scrollElRight - dimensionAdjustment + scrollPos
      }

      const paragraphPos = getParagraphPos()
      this.paragraphPos[i] = paragraphPos

      const indices = paragraphPosToIndices.get(paragraphPos) || []
      paragraphPosToIndices.set(paragraphPos, indices)
      indices.push(i)
    }

    // Build map from position to max char count at that position
    this.paragraphPosToAccCharCount = new Map(
      Array.from(paragraphPosToIndices.entries()).map(([pos, indices]) => [
        pos,
        Math.max(...indices.map((i) => this.accumulatedCharCount[i])),
      ])
    )
  }

  /**
   * Calculate explored character count based on current scroll position
   */
  calcExploredCharCount(customReadingPointScrollOffset = 0): number {
    return this.getCharCountByScrollPos(this.scrollPos + customReadingPointScrollOffset)
  }

  /**
   * Get character count at a given scroll position
   */
  getCharCountByScrollPos(scrollPos: number): number {
    const index = binarySearchNoNegative(this.paragraphPos, scrollPos)
    return this.paragraphPosToAccCharCount.get(this.paragraphPos[index]) || 0
  }

  /**
   * Get scroll position for a character count (for bookmark restoration)
   */
  getScrollPosByCharCount(charCount: number): number {
    const index = binarySearchNoNegative(this.accumulatedCharCount, charCount)
    return formatPos(this.paragraphPos[index], this.direction) || 0
  }

  private get scrollPos(): number {
    return formatPos(this.scrollEl[this.scrollPosProp], this.direction)
  }

  private get scrollPosProp(): 'scrollLeft' | 'scrollTop' {
    return this.verticalMode ? 'scrollLeft' : 'scrollTop'
  }
}
