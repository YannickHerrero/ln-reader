/**
 * Binary search utilities for pagination
 * Adapted from TTU Ebook Reader
 */

/**
 * Binary search that returns -1 if not found
 */
function binarySearchImpl(notFoundValue: -1 | undefined) {
  const binarySearchRecursive = (
    arr: number[],
    l: number,
    r: number,
    x: number
  ): number => {
    if (r < l) return notFoundValue ?? r

    const mid = Math.floor((l + r) / 2)
    if (arr[mid] === x) return mid
    if (arr[mid] > x) return binarySearchRecursive(arr, l, mid - 1, x)
    return binarySearchRecursive(arr, mid + 1, r, x)
  }

  return (arr: number[], x: number) =>
    binarySearchRecursive(arr, 0, arr.length - 1, x)
}

/**
 * Binary search for a node that intersects with a Range
 */
function binarySearchNodeInRangeImpl() {
  const binarySearchRecursive = (
    arr: Node[],
    l: number,
    r: number,
    x: Range
  ): number => {
    if (r < l) return -1

    const mid = Math.floor((l + r) / 2)

    if (x.intersectsNode(arr[mid])) {
      return mid
    }

    if (x.comparePoint(arr[mid], 0) > 0) {
      return binarySearchRecursive(arr, l, mid - 1, x)
    }
    return binarySearchRecursive(arr, mid + 1, r, x)
  }

  return (arr: Node[], x: Range) =>
    binarySearchRecursive(arr, 0, arr.length - 1, x)
}

/** Binary search returning -1 when not found */
export const binarySearch = binarySearchImpl(-1)

/** Binary search returning the closest lower index when not found */
export const binarySearchNoNegative = binarySearchImpl(undefined)

/** Binary search for nodes intersecting a Range */
export const binarySearchNodeInRange = binarySearchNodeInRangeImpl()
