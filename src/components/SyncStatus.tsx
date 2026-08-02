import { useSyncExternalStore } from 'react'
import { syncManager, type SyncStatusSource } from '../sync/manager'

function labelFor(source: ReturnType<SyncStatusSource['getSnapshot']>): string {
  if (source.phase === 'syncing') return 'Synchronisation…'
  if (source.phase === 'synced') return 'Synchronisé'
  if (source.phase === 'offline') return 'Hors ligne'
  if (source.phase === 'error') return 'Sync en attente'
  return 'Stockage local'
}

export function SyncStatus({ source = syncManager }: { source?: SyncStatusSource }) {
  const snapshot = useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot)
  const pending = snapshot.pendingCount > 0
    ? `${snapshot.pendingCount} modification${snapshot.pendingCount > 1 ? 's' : ''} en attente. `
    : ''
  const title = `${pending}${snapshot.error ?? labelFor(snapshot)}`

  return (
    <span
      className="sync-status"
      data-state={snapshot.phase}
      role="status"
      aria-live="polite"
      title={title}
    >
      <span className="sync-status__dot" aria-hidden="true" />
      <span className="sync-status__label">{labelFor(snapshot)}</span>
    </span>
  )
}
