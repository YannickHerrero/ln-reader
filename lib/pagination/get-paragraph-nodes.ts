/**
 * DOM traversal utilities for finding text nodes
 * Adapted from TTU Ebook Reader
 */

import { isNodeGaiji } from './get-character-count'

/**
 * Recursively get text nodes and gaiji nodes from an element
 * @param node - The root node to traverse
 * @param filterFn - Function to filter out unwanted nodes
 */
function getTextNodeOrGaijiNodes(
  node: Node,
  filterFn: (n: Node) => boolean
): Node[] {
  if (!node.hasChildNodes() || !filterFn(node)) {
    return []
  }

  return Array.from(node.childNodes)
    .flatMap((n) => {
      // Text nodes are returned directly
      if (n.nodeType === Node.TEXT_NODE) {
        return [n]
      }
      // Gaiji images are returned directly
      if (isNodeGaiji(n)) {
        return [n]
      }
      // Recursively process element nodes
      return getTextNodeOrGaijiNodes(n, filterFn)
    })
    .filter(filterFn)
}

/**
 * Get all paragraph/text nodes from a container, excluding:
 * - Furigana (RT elements) - these shouldn't count towards character count
 * - Hidden elements (aria-hidden, hidden attribute)
 * - Empty text nodes (whitespace only)
 */
export function getParagraphNodes(node: Node): Node[] {
  return getTextNodeOrGaijiNodes(node, (n) => {
    // Exclude furigana (ruby text)
    if (n.nodeName === 'RT') {
      return false
    }
    // Exclude hidden elements
    const isHidden =
      n instanceof HTMLElement &&
      (n.attributes.getNamedItem('aria-hidden') ||
        n.attributes.getNamedItem('hidden'))
    if (isHidden) {
      return false
    }
    return true
  }).filter((n) => {
    // Include gaiji images
    if (isNodeGaiji(n)) {
      return true
    }
    // Include text nodes with non-whitespace content
    if (n.textContent?.replace(/\s/g, '').length) {
      return true
    }
    return false
  })
}
