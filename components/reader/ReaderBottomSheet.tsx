'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ReaderSettings } from './ReaderSettings'
import type { ReaderSettings as Settings } from '@/hooks/use-reader-settings'

interface ReaderBottomSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: Settings
  onSettingsChange: (updates: Partial<Settings>) => void
}

export function ReaderBottomSheet({
  open,
  onOpenChange,
  settings,
  onSettingsChange,
}: ReaderBottomSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto max-h-[80vh]">
        <SheetHeader>
          <SheetTitle>Reading Settings</SheetTitle>
        </SheetHeader>
        <ReaderSettings
          settings={settings}
          onSettingsChange={onSettingsChange}
        />
      </SheetContent>
    </Sheet>
  )
}
