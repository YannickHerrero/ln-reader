'use client'

import { Loader2, Book } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import type { WordSelection } from '@/hooks/use-word-selection'
import { useDictionaryLookup, useDictionaryStatus, useDictionaryImport } from '@/hooks/use-dictionary'
import { useFurigana } from '@/hooks/use-furigana'
import { DictionaryResults } from './DictionaryResults'

interface WordLookupSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selection: WordSelection | null
}

function DictionaryImportPrompt() {
  const { startImport, isImporting, progress, statusMessage, error } = useDictionaryImport()

  if (isImporting) {
    return (
      <div className="flex flex-col items-center gap-2 py-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {statusMessage || `Importing... ${Math.round(progress * 100)}%`}
        </p>
        <div className="w-full max-w-xs h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <p className="text-sm text-muted-foreground text-center">
        Import the dictionary to see word definitions (~15MB)
      </p>
      <Button onClick={startImport} variant="outline" size="sm" className="gap-2">
        <Book className="h-4 w-4" />
        Import Dictionary
      </Button>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}

export function WordLookupSheet({
  open,
  onOpenChange,
  selection,
}: WordLookupSheetProps) {
  const { results, isLoading } = useDictionaryLookup(selection?.word ?? null)
  const status = useDictionaryStatus()
  const { html: wordHtml } = useFurigana(selection?.word ?? null)
  const { html: sentenceHtml, isLoading: isFuriganaLoading } = useFurigana(selection?.sentence ?? null)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto max-h-[60vh]">
        <SheetHeader>
          <SheetTitle>Word Lookup</SheetTitle>
        </SheetHeader>
        <div className="p-4">
          {selection ? (
            <div className="space-y-4">
              <div>
                {wordHtml ? (
                  <span
                    className="text-2xl font-medium furigana-word"
                    dangerouslySetInnerHTML={{ __html: wordHtml }}
                  />
                ) : (
                  <span className="text-2xl font-medium">{selection.word}</span>
                )}
              </div>
              <div className="bg-muted rounded-lg p-3">
                <p className="text-muted-foreground text-sm">Sentence:</p>
                {isFuriganaLoading || !sentenceHtml ? (
                  <p className="mt-1">{selection.sentence}</p>
                ) : (
                  <p
                    className="mt-1 furigana-sentence"
                    dangerouslySetInnerHTML={{ __html: sentenceHtml }}
                  />
                )}
              </div>

              {/* Dictionary results section */}
              {!status.installed && !status.importing ? (
                <DictionaryImportPrompt />
              ) : isLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <DictionaryResults entries={results} searchWord={selection.word} />
              )}
            </div>
          ) : (
            <div className="text-muted-foreground text-center">
              No word selected
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
