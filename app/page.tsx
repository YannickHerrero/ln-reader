'use client'

import { useState } from 'react'
import { UploadButton } from '@/components/upload-button'
import { LibraryGrid } from '@/components/library-grid'
import { DictionaryImportButton } from '@/components/DictionaryImportButton'
import { useLibrary } from '@/hooks/use-library'
import { parseEpubMetadata } from '@/lib/epub'

export default function Home() {
  const { books, addBook, isLoading } = useLibrary()
  const [isUploading, setIsUploading] = useState(false)

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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">LN Reader</h1>
          <div className="flex items-center gap-4">
            <DictionaryImportButton />
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
