'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Settings } from 'lucide-react'
import { UploadButton } from '@/components/upload-button'
import { LibraryGrid } from '@/components/library-grid'
import { DictionaryWelcome } from '@/components/DictionaryWelcome'
import { Button } from '@/components/ui/button'
import { useLibrary } from '@/hooks/use-library'
import { useDictionaryStatus } from '@/hooks/use-dictionary'
import { parseEpubMetadata } from '@/lib/epub'

export default function Home() {
  const { books, addBook, isLoading } = useLibrary()
  const [isUploading, setIsUploading] = useState(false)
  const dictionaryStatus = useDictionaryStatus()

  const handleFileSelect = async (file: File) => {
    setIsUploading(true)
    try {
      const metadata = await parseEpubMetadata(file)
      await addBook(file, metadata)
    } catch (error) {
      console.error('Failed to add book:', error)
    } finally {
      setIsUploading(false)
    }
  }

  if (!dictionaryStatus.installed) {
    return <DictionaryWelcome />
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">LN Reader</h1>
          <div className="flex items-center gap-4">
            <Link href="/settings">
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
            <UploadButton onFileSelect={handleFileSelect} disabled={isUploading} />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading library...
          </div>
        ) : (
          <LibraryGrid books={books || []} />
        )}
      </main>
    </div>
  )
}
