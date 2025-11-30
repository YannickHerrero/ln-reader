/**
 * Character counting utilities for Japanese text
 * Adapted from TTU Ebook Reader
 */

/**
 * Check if an image element is a gaiji (image-based character)
 * Gaiji are used in some EPUBs to represent characters that can't be displayed with fonts
 */
export function isElementGaiji(el: HTMLImageElement): boolean {
  return Array.from(el.classList).some((className) =>
    className.includes('gaiji')
  )
}

/**
 * Check if a node is a gaiji image
 */
export function isNodeGaiji(node: Node): boolean {
  if (!(node instanceof HTMLImageElement)) {
    return false
  }
  return isElementGaiji(node)
}

/**
 * Regex to match non-Japanese characters
 * Matches everything EXCEPT:
 * - Numbers (0-9, ０-９)
 * - Letters (A-Z, Ａ-Ｚ)
 * - Special symbols (○, ◯)
 * - CJK characters (々-〇, 〻)
 * - Hiragana (ぁ-ゖ, ゝ-ゞ)
 * - Katakana (ァ-ヺ, ー, ｦ-ﾝ)
 * - CJK Radicals and Unified Ideographs
 */
const isNotJapaneseRegex =
  /[^0-9A-Z○◯々-〇〻ぁ-ゖゝ-ゞァ-ヺー０-９Ａ-Ｚｦ-ﾝ\p{Radical}\p{Unified_Ideograph}]+/gimu

/**
 * Count characters in text, filtering to Japanese characters only
 * Handles Unicode surrogate pairs correctly (e.g., '𠮟る'.length = 3 but should be 2)
 */
function countUnicodeCharacters(s: string): number {
  return Array.from(s).length
}

/**
 * Get raw character count from a node's text content
 */
function getRawCharacterCount(node: Node): number {
  if (!node.textContent) return 0
  return countUnicodeCharacters(
    node.textContent.replace(isNotJapaneseRegex, '')
  )
}

/**
 * Get the character count for a node
 * Gaiji images count as 1 character
 * Text nodes are filtered to Japanese characters only
 */
export function getCharacterCount(node: Node): number {
  return isNodeGaiji(node) ? 1 : getRawCharacterCount(node)
}

/**
 * Count characters in HTML content string
 * Creates a temporary DOM element to parse the HTML
 * Excludes furigana (RT elements) and hidden elements
 */
export function countHtmlCharacters(html: string): number {
  if (typeof document === 'undefined') return 0

  const container = document.createElement('div')
  container.innerHTML = html

  let totalChars = 0

  // Recursive function to traverse and count
  function traverse(node: Node): void {
    // Skip furigana
    if (node.nodeName === 'RT') return

    // Skip hidden elements
    if (
      node instanceof HTMLElement &&
      (node.getAttribute('aria-hidden') || node.hasAttribute('hidden'))
    ) {
      return
    }

    // Count text nodes
    if (node.nodeType === Node.TEXT_NODE) {
      totalChars += getRawCharacterCount(node)
      return
    }

    // Count gaiji images
    if (isNodeGaiji(node)) {
      totalChars += 1
      return
    }

    // Recurse into children
    for (const child of Array.from(node.childNodes)) {
      traverse(child)
    }
  }

  traverse(container)
  return totalChars
}
