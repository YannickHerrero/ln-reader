'use client'

import type { DictionaryEntry } from '@/lib/db'

interface DictionaryResultsProps {
  entries: DictionaryEntry[]
  searchWord: string
}

function DefinitionCard({ entry, index }: { entry: DictionaryEntry; index: number }) {
  if (entry.definitions.length === 0) return null

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

          <div className="mt-1 text-sm">
            {entry.definitions.length === 1 ? (
              <p>{entry.definitions[0]}</p>
            ) : (
              <ul className="list-disc list-inside space-y-0.5">
                {entry.definitions.map((def, i) => (
                  <li key={i}>{def}</li>
                ))}
              </ul>
            )}
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
