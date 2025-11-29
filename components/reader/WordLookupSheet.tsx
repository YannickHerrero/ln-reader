'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { WordSelection } from '@/hooks/use-word-selection'

interface WordLookupSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selection: WordSelection | null
}

export function WordLookupSheet({
  open,
  onOpenChange,
  selection,
}: WordLookupSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto max-h-[60vh]">
        <SheetHeader>
          <SheetTitle>Word Lookup</SheetTitle>
        </SheetHeader>
        <div className="p-4">
          {selection ? (
            <div className="space-y-4">
              <div className="text-center">
                <span className="text-4xl font-medium">{selection.word}</span>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <p className="text-muted-foreground text-sm">Sentence:</p>
                <p className="mt-1">{selection.sentence}</p>
              </div>
              <div className="text-muted-foreground text-center text-sm">
                Definition coming soon...
              </div>
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
