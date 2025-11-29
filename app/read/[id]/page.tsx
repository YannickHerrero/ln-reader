import Link from 'next/link'

interface ReadPageProps {
  params: Promise<{ id: string }>
}

export default async function ReadPage({ params }: ReadPageProps) {
  const { id } = await params

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">Reader</h1>
      <p className="text-muted-foreground">Book ID: {id}</p>
      <p className="text-sm text-muted-foreground">
        Reader implementation coming soon...
      </p>
      <Link
        href="/"
        className="text-sm text-primary underline-offset-4 hover:underline"
      >
        Back to Library
      </Link>
    </div>
  )
}
