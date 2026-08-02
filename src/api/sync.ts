import { parseSyncState, type SyncOperation, type SyncState } from '../../shared/sync'
import type { ApiErrorBody } from '../../shared/contracts'

async function syncRequest(input: RequestInfo, init?: RequestInit): Promise<SyncState> {
  const response = await fetch(input, { ...init, cache: 'no-store' })
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'La synchronisation est indisponible.' })) as ApiErrorBody
    throw new Error(body.error || 'La synchronisation est indisponible.')
  }
  return parseSyncState(await response.json())
}

export interface SyncTransport {
  pull(): Promise<SyncState>
  push(operations: SyncOperation[]): Promise<SyncState>
}

export const syncApi: SyncTransport = {
  pull() {
    return syncRequest('/api/sync')
  },

  push(operations) {
    return syncRequest('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operations }),
    })
  },
}
