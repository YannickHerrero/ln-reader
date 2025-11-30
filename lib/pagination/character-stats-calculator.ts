/**
 * Character Statistics Calculator
 * Counts characters for progress tracking using scroll percentage
 * Adapted from TTU Ebook Reader (simplified version)
 */

import { getCharacterCount } from './get-character-count'
import { getParagraphNodes } from './get-paragraph-nodes'

export class CharacterStatsCalculator {
  /** Total character count in content */
  readonly charCount: number

  constructor(containerEl: HTMLElement) {
    // Get all text/paragraph nodes and count characters
    const paragraphs = getParagraphNodes(containerEl)
    let totalCount = 0
    for (const node of paragraphs) {
      totalCount += getCharacterCount(node)
    }
    this.charCount = totalCount
  }

  /**
   * Get scroll position for a character count (for bookmark restoration)
   * Uses scroll percentage for approximate position
   */
  getScrollPosByCharCount(
    charCount: number,
    scrollSize: number,
    viewportSize: number
  ): number {
    if (this.charCount === 0) return 0
    const percentage = Math.min(charCount / this.charCount, 1)
    const maxScroll = Math.max(scrollSize - viewportSize, 1)
    return Math.round(percentage * maxScroll)
  }
}
