'use client'

import { Book, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDictionaryImport } from '@/hooks/use-dictionary'

export function DictionaryWelcome() {
  const { startImport, isImporting, progress, statusMessage, error } = useDictionaryImport()

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="flex flex-col items-center gap-6 max-w-md text-center">
        <h1 className="text-3xl font-bold">LN Reader</h1>

        {isImporting ? (
          <div className="flex flex-col gap-4 w-full">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>{statusMessage || `Importing... ${Math.round(progress * 100)}%`}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        ) : (
          <>
            <p className="text-muted-foreground">
              Import the JMDict dictionary to enable word lookups while reading.
            </p>
            <Button onClick={startImport} size="lg" className="gap-2">
              <Book className="h-5 w-5" />
              Import Dictionary
            </Button>
            <p className="text-sm text-muted-foreground">
              ~15MB download
            </p>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
