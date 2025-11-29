'use client'

import { useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Plus } from 'lucide-react'

interface ImportCardProps {
  onFileSelect: (file: File) => void
  disabled?: boolean
}

export function ImportCard({ onFileSelect, disabled }: ImportCardProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleClick = () => {
    if (!disabled) {
      inputRef.current?.click()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.name.endsWith('.epub')) {
      onFileSelect(file)
    }
    e.target.value = ''
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".epub"
        onChange={handleChange}
        className="hidden"
      />
      <Card
        onClick={handleClick}
        className={`overflow-hidden border-2 border-dashed transition-colors cursor-pointer hover:border-primary hover:bg-muted/50 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className="aspect-[2/3] flex items-center justify-center">
          <Plus className="h-12 w-12 text-muted-foreground" />
        </div>
        <CardContent className="p-3">
          <h3 className="font-medium text-sm text-center text-muted-foreground">
            Import EPUB
          </h3>
        </CardContent>
      </Card>
    </>
  )
}
