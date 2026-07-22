const BLOCK_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, li, pre, blockquote'
const SENTENCE_TERMINALS = new Set(['.', '!', '?', '…', '。', '！', '？'])
const CLOSING_PUNCTUATION = new Set(['"', "'", '”', '’', '»', '」', '』', ')', '）', ']', '}'])
const ABBREVIATIONS = new Set([
  'm', 'mr', 'mrs', 'ms', 'mme', 'mlle', 'dr', 'prof', 'st', 'ste', 'etc', 'cf',
])

export function normalizeReaderText(text: string): string {
  return text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
}

export function extractReaderParagraphs(html: string): string[] {
  const document = new DOMParser().parseFromString(html, 'text/html')
  const blocks = [...document.body.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)]
    .filter((element) => !element.querySelector(BLOCK_SELECTOR))
    .map((element) => normalizeReaderText(element.textContent ?? ''))
    .filter(Boolean)

  if (blocks.length > 0) return blocks

  const fallback = document.body.cloneNode(true) as HTMLElement
  fallback.querySelectorAll('br').forEach((lineBreak) => lineBreak.replaceWith('\n'))
  const lines = (fallback.textContent ?? '')
    .split(/\n+/)
    .map(normalizeReaderText)
    .filter(Boolean)

  return lines.length > 0 ? lines : [normalizeReaderText(document.body.textContent ?? '')].filter(Boolean)
}

export function splitReaderSentences(paragraphs: string[]): string[] {
  const sentences = paragraphs.flatMap(splitParagraphSentences)
  return sentences.length > 0 ? sentences : paragraphs
}

function splitParagraphSentences(paragraph: string): string[] {
  const sentences: string[] = []
  const characters = Array.from(paragraph)
  let current = ''
  let index = 0

  while (index < characters.length) {
    const character = characters[index]!
    current += character

    const closingEnd = closingPunctuationEnd(characters, index)
    if (SENTENCE_TERMINALS.has(character) && shouldSplitSentence(current, characters, index, closingEnd)) {
      while (index < closingEnd) {
        current += characters[index + 1]
        index += 1
      }
      const sentence = normalizeReaderText(current)
      if (sentence) sentences.push(sentence)
      current = ''
    }
    index += 1
  }

  const remaining = normalizeReaderText(current)
  if (remaining) sentences.push(remaining)
  return sentences
}

function shouldSplitSentence(
  current: string,
  characters: string[],
  index: number,
  closingEnd: number,
): boolean {
  if (characters[index] === '.') {
    if (isDecimalPoint(characters, index) || endsWithAbbreviation(current)) return false
  }
  const next = characters[closingEnd + 1]
  return next === undefined || /\s/u.test(next)
}

function closingPunctuationEnd(characters: string[], terminalIndex: number): number {
  let cursor = terminalIndex + 1
  while (/\s/u.test(characters[cursor] ?? '')) cursor += 1
  if (!CLOSING_PUNCTUATION.has(characters[cursor] ?? '')) return terminalIndex
  while (CLOSING_PUNCTUATION.has(characters[cursor + 1] ?? '')) cursor += 1
  return cursor
}

function isDecimalPoint(characters: string[], index: number): boolean {
  return index > 0
    && index + 1 < characters.length
    && /[0-9]/.test(characters[index - 1]!)
    && /[0-9]/.test(characters[index + 1]!)
}

function endsWithAbbreviation(current: string): boolean {
  const token = current
    .trimEnd()
    .replace(/\.$/u, '')
    .split(/\s+/u)
    .at(-1)
    ?.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '')
    .toLocaleLowerCase('fr') ?? ''
  return token.length === 1 || ABBREVIATIONS.has(token)
}

export function ratioForUnit(index: number, length: number): number {
  const maximum = Math.max(0, length - 1)
  return maximum === 0 ? 1 : Math.max(0, Math.min(maximum, index)) / maximum
}

export function unitIndexFromRatio(length: number, ratio: number): number {
  const maximum = Math.max(0, length - 1)
  return Math.min(maximum, Math.round(Math.max(0, Math.min(1, ratio)) * maximum))
}
