import { syncApi } from '../api/sync'
import { sourceApi } from '../api/source'
import { db, type LibraryDatabase } from '../db/database'
import { SyncEngine } from './engine'
import { setSyncMutationHandler } from './scheduler'

export type SyncPhase = 'idle' | 'syncing' | 'synced' | 'offline' | 'error'

export interface SyncSnapshot {
  phase: SyncPhase
  pendingCount: number
  lastSyncedAt: number | null
  error: string | null
}

export interface SyncStatusSource {
  subscribe(listener: () => void): () => void
  getSnapshot(): SyncSnapshot
}

interface Synchronizer {
  synchronize(): Promise<unknown>
}

export class SyncManager implements SyncStatusSource {
  private snapshot: SyncSnapshot = {
    phase: 'idle',
    pendingCount: 0,
    lastSyncedAt: null,
    error: null,
  }
  private readonly listeners = new Set<() => void>()
  private started = false
  private running = false
  private rerunRequested = false
  private scheduledTimer: number | null = null
  private retryTimer: number | null = null
  private intervalTimer: number | null = null
  private retryDelay = 5_000

  constructor(
    private readonly database: LibraryDatabase,
    private readonly synchronizer: Synchronizer,
  ) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): SyncSnapshot => this.snapshot

  start(): () => void {
    if (this.started) return () => undefined
    this.started = true
    setSyncMutationHandler(() => this.schedule(500))
    window.addEventListener('online', this.handleOnline)
    document.addEventListener('visibilitychange', this.handleVisibilityChange)
    this.intervalTimer = window.setInterval(() => this.schedule(0), 30_000)
    this.update({ phase: 'syncing', error: null })
    this.schedule(0)
    return () => this.stop()
  }

  schedule(delay = 0): void {
    if (!this.started) return
    if (this.scheduledTimer !== null) window.clearTimeout(this.scheduledTimer)
    this.scheduledTimer = window.setTimeout(() => {
      this.scheduledTimer = null
      void this.run()
    }, delay)
  }

  private stop(): void {
    if (!this.started) return
    this.started = false
    setSyncMutationHandler(null)
    window.removeEventListener('online', this.handleOnline)
    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    if (this.scheduledTimer !== null) window.clearTimeout(this.scheduledTimer)
    if (this.retryTimer !== null) window.clearTimeout(this.retryTimer)
    if (this.intervalTimer !== null) window.clearInterval(this.intervalTimer)
    this.scheduledTimer = null
    this.retryTimer = null
    this.intervalTimer = null
  }

  private readonly handleOnline = () => this.schedule(0)

  private readonly handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') this.schedule(0)
  }

  private async run(): Promise<void> {
    if (this.running) {
      this.rerunRequested = true
      return
    }
    this.running = true
    this.rerunRequested = false
    if (this.retryTimer !== null) window.clearTimeout(this.retryTimer)
    this.retryTimer = null

    try {
      const pendingCount = await this.database.syncQueue.count()
      this.update({ phase: 'syncing', pendingCount, error: null })
      await this.synchronizer.synchronize()
      this.retryDelay = 5_000
      this.update({
        phase: 'synced',
        pendingCount: await this.database.syncQueue.count(),
        lastSyncedAt: Date.now(),
        error: null,
      })
    } catch (error) {
      this.update({
        phase: navigator.onLine ? 'error' : 'offline',
        pendingCount: await this.database.syncQueue.count().catch(() => this.snapshot.pendingCount),
        error: error instanceof Error ? error.message : 'La synchronisation a échoué.',
      })
      if (this.started) {
        const delay = this.retryDelay
        this.retryDelay = Math.min(this.retryDelay * 2, 60_000)
        this.retryTimer = window.setTimeout(() => {
          this.retryTimer = null
          this.schedule(0)
        }, delay)
      }
    } finally {
      this.running = false
      if (this.rerunRequested) this.schedule(0)
    }
  }

  private update(changes: Partial<SyncSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...changes }
    for (const listener of this.listeners) listener()
  }
}

const syncEngine = new SyncEngine(db, syncApi, (url) => sourceApi.cover(url))
export const syncManager = new SyncManager(db, syncEngine)
