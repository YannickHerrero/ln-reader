'use client'

import { BookCard } from '@/components/book-card'
import { ImportCard } from '@/components/import-card'
import type { BookWithProgress } from '@/hooks/use-library'

interface LibraryGridProps {
  books: BookWithProgress[]
  onFileSelect: (file: File) => void
  isUploading?: boolean
}

export function LibraryGrid({ books, onFileSelect, isUploading }: LibraryGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {books.map((book) => (
        <BookCard key={book.id} book={book} />
      ))}
      <ImportCard onFileSelect={onFileSelect} disabled={isUploading} />
    </div>
  )
}
