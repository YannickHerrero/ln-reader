import { describe, expect, it } from 'vitest'
import { chapterBlocksFromHtml } from '../server/source/chapter-document'

describe('native chapter document', () => {
  it('preserves sanitized block order and readable text', () => {
    expect(chapterBlocksFromHtml(`
      <h2>Un titre</h2>
      <p>Première ligne<br>Deuxième ligne avec <strong>emphase</strong>.</p>
      <blockquote><p>Une citation.</p></blockquote>
      <ol><li>Premier élément</li><li>Deuxième élément</li></ol>
      <hr>
    `)).toEqual([
      { kind: 'heading2', text: 'Un titre' },
      { kind: 'paragraph', text: 'Première ligne\nDeuxième ligne avec emphase.' },
      { kind: 'blockquote', text: 'Une citation.' },
      { kind: 'listItem', text: 'Premier élément' },
      { kind: 'listItem', text: 'Deuxième élément' },
      { kind: 'divider', text: '' },
    ])
  })

  it('falls back to plain text when the source has no block tags', () => {
    expect(chapterBlocksFromHtml('Texte brut')).toEqual([
      { kind: 'paragraph', text: 'Texte brut' },
    ])
  })
})
