import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { libraryRepository } from '../db/repository'

interface CoverArtProps {
  seriesKey: string
  title: string
  className?: string
  decorative?: boolean
}

export function CoverArt({ seriesKey, title, className = '', decorative = false }: CoverArtProps) {
  const blob = useLiveQuery(() => libraryRepository.getCover(seriesKey), [seriesKey], null)
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!blob) {
      setUrl(null)
      return
    }
    const objectUrl = URL.createObjectURL(blob)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [blob])

  return (
    <div className={`cover-art ${className}`} aria-hidden={decorative || undefined}>
      {url ? <img src={url} alt={decorative ? '' : `Couverture de ${title}`} /> : <span aria-hidden="true">{title.slice(0, 1)}</span>}
    </div>
  )
}
