'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDictionaryStatus, useDictionaryImport } from '@/hooks/use-dictionary'
import { useLibrarySettings, type LibrarySortOrder } from '@/hooks/use-library-settings'

const SORT_OPTIONS: { value: LibrarySortOrder; label: string }[] = [
  { value: 'last-opened', label: 'Last opened' },
  { value: 'last-added', label: 'Last added' },
  { value: 'progress', label: 'Progress' },
  { value: 'title', label: 'Title (A-Z)' },
  { value: 'author', label: 'Author (A-Z)' },
]

export default function SettingsPage() {
  const status = useDictionaryStatus()
  const { clear, isClearing } = useDictionaryImport()
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const { settings, setSettings } = useLibrarySettings()

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold">Settings</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl space-y-8">
          <section>
            <h2 className="text-lg font-semibold mb-4">Library</h2>
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span>Sort books by</span>
                <Select
                  value={settings.sortOrder}
                  onValueChange={(value: LibrarySortOrder) => setSettings({ sortOrder: value })}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-4">Dictionary</h2>

          {isClearing ? (
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Clearing dictionary...</span>
              </div>
            </div>
          ) : status.installed ? (
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>JMDict installed ({status.entryCount.toLocaleString()} entries)</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowClearConfirm(true)}
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </div>

              {showClearConfirm && (
                <div className="mt-4 pt-4 border-t flex items-center gap-4">
                  <span className="text-muted-foreground">Clear dictionary?</span>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      clear()
                      setShowClearConfirm(false)
                    }}
                  >
                    Yes, delete
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowClearConfirm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="border rounded-lg p-4 text-muted-foreground">
              No dictionary installed
            </div>
          )}
          </section>
        </div>
      </main>
    </div>
  )
}
