const BLOCK_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, li, pre, blockquote'
const SENTENCE_TERMINALS = new Set(['.', '!', '?', '…', '。', '！', '？'])
const CLOSING_PUNCTUATION = new Set(['"', "'", '”', '’', '»', '」', '』', ')', '）', ']', '}'])
const ABBREVIATIONS = new Set([
  'm', 'mr', 'mrs', 'ms', 'mme', 'mlle', 'dr', 'prof', 'st', 'ste',
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

    if (isSentenceTerminal(character) && shouldSplitSentence(current, characters, index)) {
      while (index + 1 < characters.length) {
        const next = characters[index + 1]!
        if (
          isClosingPunctuation(next)
          || (current.endsWith('»') && isSentenceTerminal(next))
          || (isWhitespace(next) && nextNonWhitespaceIsClosingPunctuation(characters, index + 1))
        ) {
          current += next
          index += 1
        } else {
          break
        }
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

function shouldSplitSentence(current: string, characters: string[], index: number): boolean {
  const character = characters[index]!
  if (character === '.' && (isDecimalPoint(characters, index) || endsWithAbbreviation(current))) {
    return false
  }
  if (isSentenceTerminal(characters[index + 1])) return false

  if (hasUnclosedFrenchQuote(current)) {
    let cursor = index + 1
    while (isSentenceTerminal(characters[cursor])) cursor += 1
    while (isWhitespace(characters[cursor])) cursor += 1
    if (!isClosingPunctuation(characters[cursor])) return false
    while (isClosingPunctuation(characters[cursor])) cursor += 1
    while (isSentenceTerminal(characters[cursor])) cursor += 1
    while (isWhitespace(characters[cursor])) cursor += 1
    if (characters[cursor] !== undefined && characters[cursor] !== '«') return false
  }

  let cursor = index + 1
  while (isSentenceTerminal(characters[cursor])) cursor += 1

  let sawSpacing = false
  while (isWhitespace(characters[cursor])) {
    sawSpacing = true
    cursor += 1
  }
  while (isClosingPunctuation(characters[cursor])) cursor += 1
  while (isWhitespace(characters[cursor])) {
    sawSpacing = true
    cursor += 1
  }

  const next = characters[cursor]
  if (next === undefined) return true
  if (/^\p{Ll}$/u.test(next)) return false
  return sawSpacing
}

function isSentenceTerminal(character: string | undefined): boolean {
  return character !== undefined && SENTENCE_TERMINALS.has(character)
}

function isClosingPunctuation(character: string | undefined): boolean {
  return character !== undefined && CLOSING_PUNCTUATION.has(character)
}

function isWhitespace(character: string | undefined): boolean {
  return character !== undefined && /\s/u.test(character)
}

function nextNonWhitespaceIsClosingPunctuation(characters: string[], start: number): boolean {
  let cursor = start
  while (isWhitespace(characters[cursor])) cursor += 1
  return isClosingPunctuation(characters[cursor])
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
    .replace(/\.+$/u, '')
    .split(/\s+/u)
    .at(-1)
    ?.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '')
    .toLowerCase() ?? ''
  return ABBREVIATIONS.has(token)
}

function hasUnclosedFrenchQuote(current: string): boolean {
  let openings = 0
  let closings = 0
  for (const character of current) {
    if (character === '«') openings += 1
    if (character === '»') closings += 1
  }
  return openings > closings
}

export function ratioForUnit(index: number, length: number): number {
  const maximum = Math.max(0, length - 1)
  return maximum === 0 ? 1 : Math.max(0, Math.min(maximum, index)) / maximum
}

export function unitIndexFromRatio(length: number, ratio: number): number {
  const maximum = Math.max(0, length - 1)
  return Math.min(maximum, Math.round(Math.max(0, Math.min(1, ratio)) * maximum))
}
