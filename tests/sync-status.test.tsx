import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SyncStatus } from '../src/components/SyncStatus'
import type { SyncSnapshot, SyncStatusSource } from '../src/sync/manager'

function source(snapshot: SyncSnapshot): SyncStatusSource {
  return {
    subscribe: () => () => undefined,
    getSnapshot: () => snapshot,
  }
}

describe('sync status', () => {
  it('shows a successful synchronized state', () => {
    render(<SyncStatus source={source({
      phase: 'synced',
      pendingCount: 0,
      lastSyncedAt: 100,
      error: null,
    })} />)

    expect(screen.getByRole('status')).toHaveTextContent('Synchronisé')
    expect(screen.getByRole('status')).toHaveAttribute('data-state', 'synced')
  })

  it('reports queued changes when the server is unavailable', () => {
    render(<SyncStatus source={source({
      phase: 'offline',
      pendingCount: 2,
      lastSyncedAt: null,
      error: 'Serveur indisponible.',
    })} />)

    expect(screen.getByRole('status')).toHaveTextContent('Hors ligne')
    expect(screen.getByRole('status')).toHaveAttribute(
      'title',
      '2 modifications en attente. Serveur indisponible.',
    )
  })
})
