'use client'

import { Slider } from '@/components/ui/slider'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Moon, Sun, AlignLeft, AlignJustify } from 'lucide-react'
import type { ReaderSettings as Settings } from '@/hooks/use-reader-settings'

interface ReaderSettingsProps {
  settings: Settings
  onSettingsChange: (updates: Partial<Settings>) => void
}

export function ReaderSettings({
  settings,
  onSettingsChange,
}: ReaderSettingsProps) {
  return (
    <div className="space-y-6 p-4">
      {/* Theme */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Theme</label>
        <ToggleGroup
          type="single"
          value={settings.theme}
          onValueChange={(value) => {
            if (value) onSettingsChange({ theme: value as 'light' | 'dark' })
          }}
          className="justify-start"
        >
          <ToggleGroupItem value="light" aria-label="Light theme">
            <Sun className="mr-2 h-4 w-4" />
            Light
          </ToggleGroupItem>
          <ToggleGroupItem value="dark" aria-label="Dark theme">
            <Moon className="mr-2 h-4 w-4" />
            Dark
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Font Size */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Font Size</label>
          <span className="text-muted-foreground text-sm">{settings.fontSize}px</span>
        </div>
        <Slider
          value={[settings.fontSize]}
          onValueChange={([value]) => onSettingsChange({ fontSize: value })}
          min={14}
          max={24}
          step={1}
        />
      </div>

      {/* Line Height */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Line Height</label>
          <span className="text-muted-foreground text-sm">{settings.lineHeight.toFixed(1)}</span>
        </div>
        <Slider
          value={[settings.lineHeight]}
          onValueChange={([value]) => onSettingsChange({ lineHeight: value })}
          min={1.4}
          max={2.2}
          step={0.1}
        />
      </div>

      {/* Reading Direction */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Reading Direction</label>
        <ToggleGroup
          type="single"
          value={settings.direction}
          onValueChange={(value) => {
            if (value)
              onSettingsChange({ direction: value as 'ltr' | 'vertical-rl' })
          }}
          className="justify-start"
        >
          <ToggleGroupItem value="ltr" aria-label="Left to right">
            <AlignLeft className="mr-2 h-4 w-4" />
            Classic
          </ToggleGroupItem>
          <ToggleGroupItem value="vertical-rl" aria-label="Vertical right to left">
            <AlignJustify className="mr-2 h-4 w-4 rotate-90" />
            Japanese
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  )
}
