import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { libraryRepository } from '../db/repository'

interface CoverArtProps {
  seriesKey: string
  title: string
  className?: string
}

export function CoverArt({ seriesKey, title, className = '' }: CoverArtProps) {
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
    <div className={`cover-art ${className}`}>
      {url ? <img src={url} alt={`Couverture de ${title}`} /> : <span aria-hidden="true">{title.slice(0, 1)}</span>}
    </div>
  )
}
