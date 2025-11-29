'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { BookOpen } from 'lucide-react'
import type { EpubMetadata } from '@/lib/db'

interface BookCardProps {
  book: EpubMetadata
}

export function BookCard({ book }: BookCardProps) {
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
