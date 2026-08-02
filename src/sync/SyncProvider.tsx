import { useEffect, type ReactNode } from 'react'
import { syncManager } from './manager'

export function SyncProvider({ children }: { children: ReactNode }) {
  useEffect(() => syncManager.start(), [])
  return children
}
