'use client'

import type { DictionaryEntry } from '@/lib/db'

interface DictionaryResultsProps {
  entries: DictionaryEntry[]
  searchWord: string
}

function parseDefinition(definition: string) {
  const lines = definition.split('\n')
  const parts: { reading?: string; word?: string; pos?: string; text: string[] } = {
    text: [],
  }

  for (const line of lines) {
    // Check for reading and word pattern: "reading【word】" or "reading・reading【word】"
    const headerMatch = line.match(/^(.+?)【(.+?)】$/)
    if (headerMatch) {
      parts.reading = headerMatch[1]
      parts.word = headerMatch[2]
      continue
    }

    // Check for part of speech: 〘...〙
    const posMatch = line.match(/^〘(.+?)〙(.*)$/)
    if (posMatch) {
      parts.pos = posMatch[1]
      if (posMatch[2].trim()) {
        parts.text.push(posMatch[2].trim())
      }
      continue
    }

    // Regular text line
    if (line.trim()) {
      parts.text.push(line.trim())
    }
  }

  return parts
}

function formatPartOfSpeech(pos: string): string {
  const mapping: Record<string, string> = {
    'n': 'noun',
    'v1': 'ichidan verb',
    'v5': 'godan verb',
    'v5u': 'godan verb (u)',
    'v5k': 'godan verb (ku)',
    'v5g': 'godan verb (gu)',
    'v5s': 'godan verb (su)',
    'v5t': 'godan verb (tsu)',
    'v5n': 'godan verb (nu)',
    'v5b': 'godan verb (bu)',
    'v5m': 'godan verb (mu)',
    'v5r': 'godan verb (ru)',
    'vs': 'suru verb',
    'vk': 'kuru verb',
    'adj-i': 'i-adjective',
    'adj-na': 'na-adjective',
    'adj-no': 'no-adjective',
    'adv': 'adverb',
    'conj': 'conjunction',
    'int': 'interjection',
    'prt': 'particle',
    'pn': 'pronoun',
    'exp': 'expression',
    'unc': 'unclassified',
    'abbr': 'abbreviation',
    'sl': 'slang',
    'uk': 'usually kana',
    'id': 'idiom',
    'obs': 'obsolete',
    'arch': 'archaic',
    'hon': 'honorific',
    'hum': 'humble',
    'col': 'colloquial',
    'fam': 'familiar',
    'fem': 'feminine',
    'male': 'masculine',
    'pol': 'polite',
    'vulg': 'vulgar',
  }

  const tags = pos.split(/[・,]/)
  return tags
    .map(tag => mapping[tag.trim()] || tag.trim())
    .join(', ')
}

function DefinitionCard({ entry, index }: { entry: DictionaryEntry; index: number }) {
  const firstDef = entry.definitions[0]
  if (!firstDef) return null

  const parsed = parseDefinition(firstDef)

  return (
    <div className="border-b border-border pb-3 last:border-0 last:pb-0">
      <div className="flex items-baseline gap-2">
        <span className="text-muted-foreground text-xs">{index + 1}</span>
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-medium">{entry.word}</span>
            {entry.reading && entry.reading !== entry.word && (
              <span className="text-muted-foreground text-sm">【{entry.reading}】</span>
            )}
          </div>

          {parsed.pos && (
            <div className="text-muted-foreground text-xs mt-0.5">
              {formatPartOfSpeech(parsed.pos)}
            </div>
          )}

          <div className="mt-1 text-sm">
            {parsed.text.map((line, i) => (
              <p key={i} className="mt-0.5 first:mt-0">
                {line.startsWith('→') ? (
                  <span className="text-muted-foreground">{line}</span>
                ) : (
                  line
                )}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function DictionaryResults({ entries, searchWord }: DictionaryResultsProps) {
  if (entries.length === 0) {
    return (
      <div className="text-muted-foreground text-center py-4 text-sm">
        No definition found for &quot;{searchWord}&quot;
      </div>
    )
  }

  const displayEntries = entries.slice(0, 10)

  return (
    <div className="max-h-[30vh] overflow-y-auto">
      <div className="space-y-3 pr-2">
        {displayEntries.map((entry, index) => (
          <DefinitionCard key={entry.id ?? index} entry={entry} index={index} />
        ))}
        {entries.length > 10 && (
          <div className="text-muted-foreground text-center text-xs py-2">
            Showing 10 of {entries.length} results
          </div>
        )}
      </div>
    </div>
  )
}
