import JSZip from 'jszip'
import { db, type DictionaryEntry } from '@/lib/db'
import { deinflect } from './deinflector'

const JMDICT_API_URL = '/api/dictionary'

// Yomitan term bank format
type YomitanTermEntry = [
  string,   // [0] expression (word)
  string,   // [1] reading
  string,   // [2] definitionTags (part of speech, comma-separated)
  string,   // [3] rules (inflection rules)
  number,   // [4] score (frequency)
  unknown[], // [5] glossary (definitions - can be strings or structured content)
  number,   // [6] sequence (JMdict ID)
  string,   // [7] termTags
]

// Extract plain text recursively from any node
function extractTextRecursive(node: unknown): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractTextRecursive).join('')
  if (typeof node === 'object' && node !== null) {
    const obj = node as Record<string, unknown>
    if (obj.content !== undefined) return extractTextRecursive(obj.content)
  }
  return ''
}

// Extract text from li items in a list
function extractListItems(content: unknown): string[] {
  if (typeof content === 'string') return [content]

  // Single li item (not in array)
  if (typeof content === 'object' && content !== null && !Array.isArray(content)) {
    const obj = content as Record<string, unknown>
    if (obj.tag === 'li') {
      const text = extractTextRecursive(obj.content)
      return text ? [text] : []
    }
    // Might be a ul/div wrapper, recurse into content
    if (obj.content) return extractListItems(obj.content)
    return []
  }

  // Array of items
  if (!Array.isArray(content)) return []

  const items: string[] = []
  for (const item of content) {
    if (typeof item === 'object' && item !== null) {
      const obj = item as Record<string, unknown>
      if (obj.tag === 'li') {
        const text = extractTextRecursive(obj.content)
        if (text) items.push(text)
      }
    }
  }
  return items
}

// Extract glossary definitions from Yomitan structured content
function extractGlossaryText(item: unknown): string[] {
  if (typeof item === 'string') return [item]
  if (typeof item !== 'object' || item === null) return []

  const obj = item as Record<string, unknown>

  // Handle structured-content wrapper
  if (obj.type === 'structured-content') {
    return extractGlossaryText(obj.content)
  }

  // Check data.content to identify section type
  const data = obj.data as Record<string, unknown> | undefined
  const sectionType = data?.content

  // Extract text from glossary sections
  if (sectionType === 'glossary' || sectionType === 'infoGlossary') {
    return extractListItems(obj.content)
  }

  // Skip notes, references, forms tables
  if (sectionType === 'notes' || sectionType === 'references' || sectionType === 'formsTable') {
    return []
  }

  // Recurse into content arrays
  const results: string[] = []
  if (Array.isArray(obj.content)) {
    for (const child of obj.content) {
      results.push(...extractGlossaryText(child))
    }
  } else if (obj.content) {
    results.push(...extractGlossaryText(obj.content))
  }

  return results
}

// Convert structured content to plain text definitions
function glossaryToStrings(glossary: unknown[]): string[] {
  const results: string[] = []
  for (const item of glossary) {
    results.push(...extractGlossaryText(item))
  }
  return results.filter(s => s.length > 0)
}

async function setMeta(key: string, value: string): Promise<void> {
  const existing = await db.dictionaryMeta.where('key').equals(key).first()
  if (existing) {
    await db.dictionaryMeta.update(existing.id!, { value })
  } else {
    await db.dictionaryMeta.add({ key, value })
  }
}

export interface DictionaryStatus {
  installed: boolean
  importing: boolean
  entryCount: number
}

export async function getDictionaryStatus(): Promise<DictionaryStatus> {
  try {
    const statusMeta = await db.dictionaryMeta.where('key').equals('import_status').first()
    const countMeta = await db.dictionaryMeta.where('key').equals('entry_count').first()

    const status = statusMeta?.value ?? 'none'
    const entryCount = countMeta ? parseInt(countMeta.value, 10) : 0

    return {
      installed: status === 'complete',
      importing: status === 'importing',
      entryCount,
    }
  } catch {
    return { installed: false, importing: false, entryCount: 0 }
  }
}

export async function lookupWord(word: string): Promise<DictionaryEntry[]> {
  const status = await getDictionaryStatus()
  if (!status.installed) {
    return []
  }

  // Get all possible dictionary forms
  const forms = deinflect(word)
  const allResults: DictionaryEntry[] = []
  const seenIds = new Set<number>()

  for (const form of forms) {
    // Search by word (kanji form)
    const wordMatches = await db.dictionary.where('word').equals(form).toArray()
    for (const match of wordMatches) {
      if (!seenIds.has(match.jmdictId)) {
        seenIds.add(match.jmdictId)
        allResults.push(match)
      }
    }

    // Search by readings
    const readingMatches = await db.dictionary
      .where('reading').equals(form)
      .toArray()
    for (const match of readingMatches) {
      if (!seenIds.has(match.jmdictId)) {
        seenIds.add(match.jmdictId)
        allResults.push(match)
      }
    }

    const reading2Matches = await db.dictionary
      .where('reading2').equals(form)
      .toArray()
    for (const match of reading2Matches) {
      if (!seenIds.has(match.jmdictId)) {
        seenIds.add(match.jmdictId)
        allResults.push(match)
      }
    }

    const reading3Matches = await db.dictionary
      .where('reading3').equals(form)
      .toArray()
    for (const match of reading3Matches) {
      if (!seenIds.has(match.jmdictId)) {
        seenIds.add(match.jmdictId)
        allResults.push(match)
      }
    }
  }

  // Sort by frequency (higher = more common)
  allResults.sort((a, b) => b.frequency - a.frequency)

  return allResults
}

export async function importDictionary(
  onProgress?: (progress: number, status?: string) => void
): Promise<void> {
  // Check if already importing
  const status = await getDictionaryStatus()
  if (status.importing) {
    throw new Error('Import already in progress')
  }

  // Clear existing data
  await db.dictionary.clear()
  await db.dictionaryMeta.clear()

  // Mark as importing
  await setMeta('import_status', 'importing')

  let totalEntries = 0

  try {
    // Download ZIP via API proxy
    onProgress?.(0.05, 'Downloading dictionary...')
    const response = await fetch(JMDICT_API_URL)
    if (!response.ok) {
      throw new Error(`Failed to download dictionary: ${response.status}`)
    }

    const blob = await response.blob()
    onProgress?.(0.3, 'Extracting dictionary...')

    // Extract ZIP
    const zip = await JSZip.loadAsync(blob)

    // Find all term_bank files
    const termBankFiles = Object.keys(zip.files)
      .filter(name => name.match(/term_bank_\d+\.json$/))
      .sort((a, b) => {
        const numA = parseInt(a.match(/term_bank_(\d+)/)?.[1] || '0')
        const numB = parseInt(b.match(/term_bank_(\d+)/)?.[1] || '0')
        return numA - numB
      })

    if (termBankFiles.length === 0) {
      throw new Error('No term bank files found in dictionary')
    }

    // Process each term bank
    for (let i = 0; i < termBankFiles.length; i++) {
      const fileName = termBankFiles[i]
      const content = await zip.file(fileName)?.async('string')
      if (!content) continue

      const entries = JSON.parse(content) as YomitanTermEntry[]

      // Filter out "forms" entries (just list alternative writings, no definitions)
      const definitionEntries = entries.filter(raw => raw[2] !== 'forms')

      const transformed: Omit<DictionaryEntry, 'id'>[] = definitionEntries.map(raw => ({
        word: raw[0],
        reading: raw[1],
        reading2: '',  // Yomitan format doesn't have extra readings
        reading3: '',
        frequency: raw[4],
        definitions: glossaryToStrings(raw[5]),
        jmdictId: raw[6],
      }))

      await db.dictionary.bulkAdd(transformed as DictionaryEntry[])
      totalEntries += definitionEntries.length

      const progress = 0.3 + (0.7 * (i + 1) / termBankFiles.length)
      onProgress?.(progress, `Processing ${i + 1}/${termBankFiles.length}...`)
    }

    // Mark as complete
    await setMeta('import_status', 'complete')
    await setMeta('entry_count', totalEntries.toString())
  } catch (error) {
    // Mark as failed
    await setMeta('import_status', 'failed')
    throw error
  }
}

export async function clearDictionary(): Promise<void> {
  await db.dictionary.clear()
  await db.dictionaryMeta.clear()
}
