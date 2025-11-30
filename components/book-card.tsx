'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { BookOpen } from 'lucide-react'
import type { BookWithProgress } from '@/hooks/use-library'

interface BookCardProps {
  book: BookWithProgress
}

export function BookCard({ book }: BookCardProps) {
  const progressPercent = book.readingProgress
    ? Math.round(book.readingProgress * 100)
    : 0

  return (
    <Link href={`/read/${book.id}`}>
      <Card className="overflow-hidden transition-shadow hover:shadow-lg cursor-pointer">
        <div className="aspect-[2/3] bg-muted relative flex items-center justify-center">
          {book.coverUrl ? (
            <img
              src={book.coverUrl}
              alt={book.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <BookOpen className="h-12 w-12 text-muted-foreground" />
          )}
          {progressPercent > 0 && (
            <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
              {progressPercent}%
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 pt-8">
            <h3 className="font-medium text-sm line-clamp-2 text-white">{book.title}</h3>
            <p className="text-xs text-white/70 line-clamp-1">
              {book.author}
            </p>
          </div>
        </div>
      </Card>
    </Link>
  )
}
