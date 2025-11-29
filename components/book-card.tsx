'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { BookOpen } from 'lucide-react'
import type { EpubMetadata } from '@/lib/db'

interface BookCardProps {
  book: EpubMetadata
}

export function BookCard({ book }: BookCardProps) {
  return (
    <Link href={`/read/${book.id}`}>
      <Card className="overflow-hidden transition-shadow hover:shadow-lg cursor-pointer">
        <div className="aspect-[2/3] bg-muted flex items-center justify-center">
          {book.coverUrl ? (
            <img
              src={book.coverUrl}
              alt={book.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <BookOpen className="h-12 w-12 text-muted-foreground" />
          )}
        </div>
        <CardContent className="p-3">
          <h3 className="font-medium text-sm line-clamp-2">{book.title}</h3>
          <p className="text-xs text-muted-foreground line-clamp-1">
            {book.author}
          </p>
        </CardContent>
      </Card>
    </Link>
  )
}
