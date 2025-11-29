import { EpubReader } from '@/components/reader/EpubReader'

interface ReadPageProps {
  params: Promise<{ id: string }>
}

export default async function ReadPage({ params }: ReadPageProps) {
  const { id } = await params
  const bookId = parseInt(id, 10)

  if (isNaN(bookId)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-destructive">Invalid book ID</p>
      </div>
    )
  }

  return <EpubReader bookId={bookId} />
}
