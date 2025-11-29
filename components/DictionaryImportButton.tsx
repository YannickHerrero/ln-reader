'use client'

import { Book, Loader2, Check, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDictionaryStatus, useDictionaryImport } from '@/hooks/use-dictionary'
import { useState } from 'react'

export function DictionaryImportButton() {
  const status = useDictionaryStatus()
  const { startImport, clear, isImporting, progress, statusMessage, error } = useDictionaryImport()
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  if (isImporting) {
    return (
      <div className="flex flex-col gap-2 w-full max-w-xs">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{statusMessage || `Importing... ${Math.round(progress * 100)}%`}</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
    )
  }

  if (status.installed) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Check className="h-4 w-4 text-green-500" />
            <span>Dictionary installed ({status.entryCount.toLocaleString()} entries)</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowClearConfirm(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        {showClearConfirm && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Clear dictionary?</span>
            <Button size="sm" variant="destructive" onClick={() => { clear(); setShowClearConfirm(false) }}>
              Yes
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowClearConfirm(false)}>
              No
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={startImport} variant="outline" className="gap-2">
        <Book className="h-4 w-4" />
        Import Dictionary
      </Button>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      <p className="text-xs text-muted-foreground">
        JMDict dictionary for word lookups (~15MB download)
      </p>
    </div>
  )
}
