/**
 * Character Statistics Calculator
 * Maps scroll positions to character counts for accurate progress tracking
 * Adapted from TTU Ebook Reader
 */

import { binarySearch, binarySearchNoNegative } from './binary-search'
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

  /** Timer for forced initialization */
  private forcedInitTimer: ReturnType<typeof setTimeout> | undefined

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
    this.paragraphPos = Array(this.paragraphs.length)
    this.accumulatedCharCount = []

    // Calculate accumulated character counts
    let exploredCharCount = 0
    this.paragraphs.forEach((node) => {
      exploredCharCount += getCharacterCount(node)
      this.accumulatedCharCount.push(exploredCharCount)
    })
    this.charCount = exploredCharCount
  }

  get verticalMode(): boolean {
    return this.axis === 'vertical'
  }

  /**
   * Update paragraph positions if not already initialized
   */
  updateParagraphPosIfNeeded(scrollPos = 0): void {
    if (this.forcedInitTimer) {
      clearTimeout(this.forcedInitTimer)
    }

    this.forcedInitTimer = setTimeout(() => {
      if (typeof this.paragraphPos[0] !== 'number') {
        this.updateParagraphPos(scrollPos)
      }
    })
  }

  /**
   * Update all paragraph positions based on current scroll position
   * This maps each paragraph to its scroll position
   */
  updateParagraphPos(scrollPos = 0): void {
    if (this.forcedInitTimer) {
      clearTimeout(this.forcedInitTimer)
    }

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

  /**
   * Get character count up to a specific Range (for custom reading points)
   */
  getCharCountToPoint(customReadingPoint: Range): number {
    const index = Math.max(
      0,
      this.binarySearchNodeInRange(this.paragraphs, customReadingPoint)
    )
    return this.accumulatedCharCount[index - 1] || 0
  }

  /**
   * Get bookmark position for rendering bookmark indicator
   */
  getBookMarkPosForSection(
    startCount: number,
    charCount: number
  ): { bookmarkPos?: { top: number; left: number }; node?: Node; isFirstNode: boolean } {
    const index = Math.max(
      0,
      binarySearch(this.accumulatedCharCount, charCount - startCount)
    )

    let finalIndex = index
    let bookmarkPos = this.processSectionBookmarkIteration(index, startCount, charCount)

    if (!bookmarkPos) {
      for (let i = index + 1; i < this.accumulatedCharCount.length; i += 1) {
        bookmarkPos = this.processSectionBookmarkIteration(i, startCount, charCount)
        if (bookmarkPos) {
          finalIndex = i
          break
        }
      }
    }

    return {
      bookmarkPos,
      node: bookmarkPos ? this.paragraphs[finalIndex] : undefined,
      isFirstNode: finalIndex === 0,
    }
  }

  private processSectionBookmarkIteration(
    index: number,
    startCount: number,
    charCount: number
  ): { top: number; left: number } | undefined {
    const currentCharSum = this.accumulatedCharCount[index] + startCount

    if (currentCharSum > charCount) {
      let container = this.paragraphs[index]

      if (container.parentElement) {
        container = container.parentElement.closest('p') || container.parentElement
      }

      const { top, right, left } = getNodeBoundingRect(this.document, container)

      return this.axis === 'horizontal' ? { top: 0, left: right } : { top, left }
    }

    return undefined
  }

  private binarySearchNodeInRange(arr: Node[], range: Range): number {
    const binarySearchRecursive = (l: number, r: number): number => {
      if (r < l) return -1

      const mid = Math.floor((l + r) / 2)

      if (range.intersectsNode(arr[mid])) {
        return mid
      }

      if (range.comparePoint(arr[mid], 0) > 0) {
        return binarySearchRecursive(l, mid - 1)
      }
      return binarySearchRecursive(mid + 1, r)
    }

    return binarySearchRecursive(0, arr.length - 1)
  }

  private get scrollPos(): number {
    return formatPos(this.scrollEl[this.scrollPosProp], this.direction)
  }

  private get scrollPosProp(): 'scrollLeft' | 'scrollTop' {
    return this.verticalMode ? 'scrollLeft' : 'scrollTop'
  }
}
