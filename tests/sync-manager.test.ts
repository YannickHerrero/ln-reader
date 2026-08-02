import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LibraryDatabase } from '../src/db/database'
import { SyncManager } from '../src/sync/manager'
import { scheduleSyncAfterMutation } from '../src/sync/scheduler'

let database: LibraryDatabase

beforeEach(() => {
  database = new LibraryDatabase(`sync-manager-${crypto.randomUUID()}`)
})

afterEach(async () => {
  await database.delete()
  vi.restoreAllMocks()
})

describe('sync manager', () => {
  it('syncs on startup and debounces later local mutations', async () => {
    const synchronize = vi.fn().mockResolvedValue(undefined)
    const manager = new SyncManager(database, { synchronize })
    const stop = manager.start()
    try {
      await vi.waitFor(() => expect(synchronize).toHaveBeenCalledTimes(1))
      expect(manager.getSnapshot()).toMatchObject({ phase: 'synced', pendingCount: 0 })

      scheduleSyncAfterMutation()
      await new Promise((resolve) => setTimeout(resolve, 550))
      await vi.waitFor(() => expect(synchronize).toHaveBeenCalledTimes(2))
    } finally {
      stop()
    }
  })
})
