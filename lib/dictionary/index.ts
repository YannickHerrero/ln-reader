import { db, type DictionaryEntry } from '@/lib/db'
import { deinflect } from './deinflector'

type JMDictRawEntry = [
  string,   // word
  string,   // reading
  string,   // reading2
  string,   // reading3
  number,   // frequency
  string[], // definitions
  number,   // id
  string,   // reserved
]

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
  onProgress?: (progress: number) => void
): Promise<void> {
  const TOTAL_BANKS = 28

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
    for (let i = 1; i <= TOTAL_BANKS; i++) {
      const response = await fetch(`/jmdict/term_bank_${i}.json`)
      if (!response.ok) {
        throw new Error(`Failed to fetch term_bank_${i}.json`)
      }

      const entries = await response.json() as JMDictRawEntry[]

      // Transform and batch insert
      const transformed: Omit<DictionaryEntry, 'id'>[] = entries.map(raw => ({
        word: raw[0],
        reading: raw[1],
        reading2: raw[2],
        reading3: raw[3],
        frequency: raw[4],
        definitions: raw[5],
        jmdictId: raw[6],
      }))

      await db.dictionary.bulkAdd(transformed as DictionaryEntry[])
      totalEntries += entries.length

      onProgress?.(i / TOTAL_BANKS)
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
