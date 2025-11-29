'use client'

import { useRef } from 'react'
import { Card } from '@/components/ui/card'
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
        <div className="aspect-[2/3] flex flex-col items-center justify-center gap-2">
          <Plus className="h-12 w-12 text-muted-foreground" />
          <span className="font-medium text-sm text-muted-foreground">
            Import EPUB
          </span>
        </div>
      </Card>
    </>
  )
}
