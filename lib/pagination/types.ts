/**
 * Pagination system types
 * Adapted from TTU Ebook Reader
 */

export interface PageManagerApi {
  /** Navigate to next page */
  nextPage: () => void
  /** Navigate to previous page */
  prevPage: () => void
  /** Flip page by multiplier (1 = next, -1 = prev) */
  flipPage: (multiplier: 1 | -1) => void
  /** Scroll to specific position */
  scrollTo: (pos: number, isUser: boolean) => void
  /** Current virtual scroll position */
  virtualScrollPos: number
  /** Force recalculation of layout */
  recalculate: () => void
}

export interface CharacterStatsApi {
  /** Total character count in content */
  readonly charCount: number
  /** Accumulated character count per paragraph */
  readonly accumulatedCharCount: number[]
  /** Scroll position for each paragraph */
  readonly paragraphPos: number[]
  /** Update paragraph positions based on current scroll */
  updateParagraphPos: (scrollPos?: number) => void
  /** Get character count at a scroll position */
  getCharCountByScrollPos: (scrollPos: number) => number
  /** Get scroll position for a character count */
  getScrollPosByCharCount: (charCount: number) => number
  /** Calculate explored character count */
  calcExploredCharCount: (scrollPos?: number) => number
}

export interface BookmarkData {
  /** Book/metadata ID */
  metadataId: number
  /** Chapter index */
  chapterIndex: number
  /** Number of characters read */
  exploredCharCount: number
  /** Total characters in book */
  bookCharCount: number
  /** Progress ratio (0-1) */
  progress: number
  /** Last modification timestamp */
  lastRead: Date
}

export interface PageContent {
  type: 'text' | 'image'
  content: string
}
