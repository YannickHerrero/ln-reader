'use client'

import { BookCard } from '@/components/book-card'
import { ImportCard } from '@/components/import-card'
import type { EpubMetadata } from '@/lib/db'

interface LibraryGridProps {
  books: EpubMetadata[]
  onFileSelect: (file: File) => void
  isUploading?: boolean
}

export function LibraryGrid({ books, onFileSelect, isUploading }: LibraryGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      <ImportCard onFileSelect={onFileSelect} disabled={isUploading} />
      {books.map((book) => (
        <BookCard key={book.id} book={book} />
      ))}
    </div>
  )
}
