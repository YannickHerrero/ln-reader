import * as cheerio from 'cheerio'
import type { SourceChapterBlock, SourceChapterBlockKind } from '../../shared/contracts'

const BLOCK_SELECTOR = 'p, h2, h3, blockquote, li, hr'

function normalizedText(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim()
}

function blockKind(tagName: string): SourceChapterBlockKind {
  if (tagName === 'h2') return 'heading2'
  if (tagName === 'h3') return 'heading3'
  if (tagName === 'blockquote') return 'blockquote'
  if (tagName === 'li') return 'listItem'
  if (tagName === 'hr') return 'divider'
  return 'paragraph'
}

export function chapterBlocksFromHtml(html: string): SourceChapterBlock[] {
  const $ = cheerio.load(html, null, false)
  const blocks: SourceChapterBlock[] = []

  $(BLOCK_SELECTOR).each((_index, element) => {
    if ($(element).parents(BLOCK_SELECTOR).length > 0) return
    const kind = blockKind(element.tagName.toLowerCase())
    if (kind === 'divider') {
      blocks.push({ kind, text: '' })
      return
    }

    const clone = $(element).clone()
    clone.find('br').replaceWith('\n')
    const text = normalizedText(clone.text())
    if (text) blocks.push({ kind, text })
  })

  if (blocks.length > 0) return blocks
  const text = normalizedText($.root().text())
  return text ? [{ kind: 'paragraph', text }] : []
}
