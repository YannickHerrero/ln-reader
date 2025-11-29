# TTU Ebook Reader - Pagination System Technical Documentation

## Overview

The TTU Ebook Reader implements a sophisticated pagination system for web-based ebook reading, supporting both horizontal (LTR) and vertical (RTL) reading modes. The system uses **CSS multi-column layout** for content flow and **JavaScript-based navigation** for page switching.

---

## Architecture

### Core Components

```
book-reader.svelte
    ├── book-reader-paginated/
    │   ├── book-reader-paginated.svelte    # Main paginated reader component
    │   ├── page-manager-paginated.ts       # Page navigation logic
    │   ├── section-character-stats-calculator.ts  # Character position tracking
    │   └── bookmark-manager-paginated.ts   # Bookmark management
    └── book-reader-continuous/
        ├── character-stats-calculator.ts   # Core character/position calculations
        └── page-manager-continuous.ts      # Continuous scroll navigation
```

### View Modes

The reader supports two view modes (`ViewMode` enum):
1. **Paginated** - CSS column-based pagination with discrete pages
2. **Continuous** - Traditional scrolling (uses 95% scroll increments)

---

## CSS Multi-Column Pagination

### How Content is Divided into Pages

The pagination relies on **CSS multi-column layout**. The browser automatically flows content into columns.

**Key CSS Properties** (from `book-reader-paginated.svelte` lines 751-765):

```scss
.book-content-container {
  column-count: var(--book-content-column-count, 1);  // Number of columns per page
  column-width: var(--book-content-child-column-width, auto);
  column-gap: 40px;           // Fixed 40px gap between columns
  column-fill: auto;          // Fill columns sequentially, not balanced
  height: var(--book-content-child-height, 95vh);  // Fixed height forces column overflow
}
```

### Column Count Calculation

From `book-reader-paginated.svelte` line 186:

```typescript
columnCount = verticalMode ? 1 : pageColumns || Math.ceil(width / 1000);
```

- **Vertical mode**: Always 1 column
- **Horizontal mode**: User-defined `pageColumns` OR automatic calculation (`width / 1000` rounded up)

### How "Pages" Are Created

1. Content is rendered into the container with a **fixed height**
2. CSS columns automatically flow the content horizontally (or vertically)
3. Content that exceeds the viewport width creates overflow
4. Each "page" is one viewport-width of columns
5. The `overflow: hidden` on `.book-content` hides columns not in view

---

## Page Navigation System

### PageManagerPaginated Class

**File**: `page-manager-paginated.ts`

**Constructor Parameters**:
```typescript
constructor(
  contentEl: HTMLElement,      // Inner content container
  scrollEl: HTMLElement,       // Scrollable container
  sections: Element[],         // Chapter/section elements
  sectionIndex$: BehaviorSubject<number>,  // Current section
  virtualScrollPos$: BehaviorSubject<number>,  // Virtual scroll position
  width: number,               // Viewport width
  height: number,              // Viewport height
  pageGap: number,             // Gap between pages (40px)
  verticalMode: boolean,       // Reading direction
  pageChange$: Subject<boolean>,  // Page change events
  sectionRenderComplete$: Subject<number>  // Section render events
)
```

### Page Flip Algorithm (`flipPage` method)

The core navigation logic (lines 76-124):

```typescript
flipPage(multiplier: 1 | -1) {
  const scrollSizeProp = verticalMode ? 'scrollHeight' : 'scrollWidth';
  const viewportSize = verticalMode ? height : width;
  const offset = viewportSize + pageGap;  // One page = viewport + gap

  // Calculate boundaries
  const minValue = 0;
  const maxValue = scrollEl[scrollSizeProp];
  const currentValue = virtualScrollPos$.getValue();
  const newValue = currentValue + offset * multiplier;

  // Boundary conditions
  if (newValue < minValue) {
    // Go to previous section if at start
    this.prevSection(...);
  } else if (newValue >= maxValue) {
    // Go to next section if at end
    this.nextSection(...);
  } else {
    // Normal page navigation
    this.scrollOrTranslateToPos(newValue, ...);
  }
}
```

### Two Navigation Methods

1. **Scroll-based** (`scrollToPos`):
   ```typescript
   scrollEl.scrollTo({ [verticalMode ? 'top' : 'left']: pos });
   ```

2. **Transform-based** (`translateXToPos`):
   ```typescript
   contentEl.style.transform = `translateX(${pos}px)`;
   ```

**When translateX is used**: When scrolling past the content boundary (edge case handling for partial pages at section end).

### Virtual Scroll Position

The system maintains a **virtual scroll position** (`virtualScrollPos$`) separate from actual DOM scroll. This is critical for:
- Tracking position across sections
- Calculating character counts
- Bookmark restoration

---

## Content Visibility per Page

### Determining Visible Content

The visible content is determined by:

1. **Viewport dimensions** (width × height)
2. **Current scroll/transform position**
3. **CSS overflow: hidden** clips content outside viewport

**Calculation**:
```
Page content width = viewportWidth
Page boundary = virtualScrollPos to (virtualScrollPos + viewportWidth)
```

### Page Count Calculation

While not explicitly stored as a "total pages" variable, the total scrollable pages can be derived:

```typescript
totalPages = Math.ceil(scrollEl.scrollWidth / (viewportWidth + pageGap))
```

---

## Section Management

### Multi-Section Books

Books are split into **sections** (chapters). Each section is rendered separately:

```typescript
// From book-reader-paginated.svelte lines 194-201
const tempContainer = document.createElement('div');
tempContainer.innerHTML = htmlContent;
sections = Array.from(tempContainer.children);
sectionIndex$.next(0);  // Start at first section
```

### Section Navigation

**Previous Section** (lines 132-149):
```typescript
prevSection(offset, scrollSizeProp, viewportSize, isUser) {
  const nextPage = sectionIndex$.getValue() - 1;
  if (nextPage < 0) return false;

  updateSectionIndex(nextPage).subscribe(() => {
    // Calculate scroll position to land at end of previous section
    const scrollSize = scrollEl[scrollSizeProp];
    let scrollValue = offset * (Math.ceil(scrollSize / offset) - 1);
    // Navigate to last page of previous section
    scrollOrTranslateToPos(scrollValue, ...);
  });
}
```

**Next Section** (lines 152-162):
```typescript
nextSection(isUser) {
  const nextPage = sectionIndex$.getValue() + 1;
  if (nextPage >= sections.length) return false;

  updateSectionIndex(nextPage).subscribe(() => {
    scrollToPos(0, isUser);  // Start at beginning of next section
  });
}
```

---

## Character-Based Progress Tracking

### Why Character Counting?

The system uses **character count** rather than page numbers for:
- Consistent progress across different viewport sizes
- Accurate bookmark restoration after resize
- Cross-device synchronization

### SectionCharacterStatsCalculator

**File**: `section-character-stats-calculator.ts`

**Key Data Structures**:
```typescript
class SectionCharacterStatsCalculator {
  readonly charCount: number;           // Total characters in book
  private sectionAccCharCounts: number[]; // Accumulated chars per section
  private calculator: CharacterStatsCalculator;  // Per-section calculator
}
```

### Character Count Initialization

```typescript
// Lines 35-44
const getSectionCharCount = (section: Element) => {
  const paragraphs = getParagraphNodes(section);
  return paragraphs.reduce((acc, cur) => acc + getCharacterCount(cur), 0);
};

let exploredCharCount = 0;
sectionAccCharCounts = sections.map((section) => {
  exploredCharCount += getSectionCharCount(section);
  return exploredCharCount;  // Accumulated total
});
```

### Character Counting Rules

**File**: `get-character-count.ts`

```typescript
// Only counts Japanese characters and specific symbols
const isNotJapaneseRegex =
  /[^0-9A-Z○◯々-〇〻ぁ-ゖゝ-ゞァ-ヺー０-９Ａ-Ｚｦ-ﾝ\p{Radical}\p{Unified_Ideograph}]+/gimu;

function getRawCharacterCount(node: Node) {
  return countUnicodeCharacters(node.textContent.replace(isNotJapaneseRegex, ''));
}
```

**Special handling**:
- Furigana (`<rt>` elements) are **excluded** from character count
- "Gaiji" (image-based characters) count as **1 character**
- Handles Unicode surrogate pairs correctly

### Mapping Scroll Position to Character Count

**CharacterStatsCalculator** (lines 64-109):

```typescript
updateParagraphPos(scrollPos = 0) {
  // For each paragraph node
  for (let i = 0; i < paragraphs.length; i++) {
    const nodeRect = getNodeBoundingRect(document, node);

    // Calculate paragraph position relative to scroll
    const paragraphPos = nodeLeft - scrollElRight - dimensionAdjustment + scrollPos;
    this.paragraphPos[i] = paragraphPos;
  }

  // Build position -> character count mapping
  paragraphPosToAccCharCount = new Map(...);
}
```

### Getting Character Count by Scroll Position

```typescript
getCharCountByScrollPos(scrollPos: number) {
  // Binary search for nearest paragraph
  const index = binarySearchNoNegative(paragraphPos, scrollPos);
  return paragraphPosToAccCharCount.get(paragraphPos[index]) || 0;
}
```

---

## Bookmark System

### BookmarkManagerPaginated

**File**: `bookmark-manager-paginated.ts`

### Saving Bookmarks

```typescript
formatBookmarkData(bookId: number): BooksDbBookmarkData {
  const exploredCharCount = calculator.calcExploredCharCount(customReadingPointRange);
  const bookCharCount = calculator.charCount;

  return {
    dataId: bookId,
    exploredCharCount,
    progress: exploredCharCount / bookCharCount,
    lastBookmarkModified: new Date().getTime()
  };
}
```

### Restoring Bookmarks

```typescript
scrollToBookmark(bookmarkData: BooksDbBookmarkData) {
  const charCount = bookmarkData.exploredCharCount;

  // Find which section contains this character count
  const index = calculator.getSectionIndexByCharCount(charCount);

  // If different section, switch first
  if (currentSectionIndex !== index) {
    sectionIndex$.next(index);
    // Wait for section to render, then scroll
    sectionReady$.subscribe((updatedCalc) => {
      const scrollPos = updatedCalc.getScrollPosByCharCount(charCount);
      pageManager.scrollTo(scrollPos, false);
    });
  } else {
    const scrollPos = calculator.getScrollPosByCharCount(charCount);
    pageManager.scrollTo(scrollPos, false);
  }
}
```

---

## Vertical Mode Differences

### CSS for Vertical Reading

```scss
.book-content--writing-vertical-rl {
  .book-content-container {
    column-width: var(--book-content-child-height, 100vh);  // Columns by height
    width: 100%;
    height: auto;
  }
}
```

### Navigation Direction Mapping

From `book-reader-paginated.svelte` lines 637-651:

```typescript
function onKeydown(ev: KeyboardEvent) {
  switch (ev.code) {
    case 'ArrowLeft':
      concretePageManager[verticalMode ? 'nextPage' : 'prevPage']();
      break;
    case 'ArrowRight':
      concretePageManager[verticalMode ? 'prevPage' : 'nextPage']();
      break;
    // ArrowUp/Down always prev/next regardless of mode
  }
}
```

---

## Input Handling

### Swipe Gestures

```typescript
function onSwipe(ev: CustomEvent<{ direction: 'top' | 'right' | 'left' | 'bottom' }>) {
  const swipeLeft = ev.detail.direction === 'left';
  const nextPage = verticalMode ? !swipeLeft : swipeLeft;
  concretePageManager.flipPage(nextPage ? 1 : -1);
}
```

### Mouse Wheel

```typescript
fromEvent<WheelEvent>(document.body, 'wheel', { passive: true })
  .pipe(throttleTime(50))
  .subscribe((ev) => {
    let multiplier = (ev.deltaX < 0 ? -1 : 1) * (verticalMode ? -1 : 1);
    if (!ev.deltaX) {
      multiplier = ev.deltaY < 0 ? -1 : 1;
    }
    concretePageManager.flipPage(multiplier);
  });
```

---

## Resize Handling

When the viewport resizes:

1. **Store current character count** (`previousIntendedCount`)
2. **Wait for section re-render** (`sectionReady$`)
3. **Recalculate paragraph positions**
4. **Scroll to same character position**

```typescript
combineLatest([width$, height$])
  .pipe(
    skip(1),
    switchMap(() => sectionReady$.pipe(take(1)))
  )
  .subscribe(() => {
    concretePageManager.scrollTo(0, false);
    calculator.updateParagraphPos();

    // Restore position by character count
    const scrollPos = calculator.getScrollPosByCharCount(previousIntendedCount);
    concretePageManager.scrollTo(scrollPos, false);
  });
```

---

## Section Progress Tracking

### Progress Data Structure

```typescript
type SectionWithProgress = {
  reference: string;  // Section ID
  progress: number;   // 0-100
};

// Map of section ID -> progress
sectionData: Map<string, SectionWithProgress>
```

### Progress Calculation

```typescript
updateSectionDataByOffset(offset = 0) {
  const currentPercentage = (virtualScrollPos / totalScrollSize) * 100;
  updateSectionData(currentSectionId, currentPercentage);
}

updateSectionData(ref: string, progress: number) {
  // Mark current section with its progress
  // Mark all previous sections as 100%
  // Mark all following sections as 0%
}
```

---

## Summary

| Aspect | Implementation |
|--------|----------------|
| **Page Layout** | CSS multi-column (`column-count`, `column-gap: 40px`) |
| **Page Switching** | `scrollTo()` or `translateX()` transform |
| **Page Size** | `viewportWidth + pageGap (40px)` |
| **Progress Tracking** | Character count (Japanese chars only) |
| **Section Handling** | Lazy render current section only |
| **Bookmark Restoration** | CharCount → SectionIndex → ScrollPos |
| **Vertical Mode** | Swapped axes, inverted controls |
