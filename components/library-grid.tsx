'use client'

import { BookCard } from '@/components/book-card'
import type { EpubMetadata } from '@/lib/db'

interface LibraryGridProps {
  books: EpubMetadata[]
}

export function LibraryGrid({ books }: LibraryGridProps) {
  if (books.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No books in your library yet.</p>
        <p className="text-sm">Upload an EPUB to get started.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {books.map((book) => (
        <BookCard key={book.id} book={book} />
      ))}
    </div>
  )
}
