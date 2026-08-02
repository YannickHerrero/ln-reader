import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type {
  SaveProgressOperation,
  SyncOperation,
  SyncState,
  SyncedProgressRecord,
  SyncedSeriesRecord,
} from '../shared/sync'

interface SeriesRow {
  payload: string | null
  added_at: number
  updated_at: number
  changed_at: number
  deleted: number
}

interface ProgressRow {
  series_key: string
  scroll_ratio: number
  completed: number
  last_read_at: number
  changed_at: number
  deleted: number
}

export interface SyncStateStore {
  getState(): SyncState
  applyOperations(operations: SyncOperation[]): SyncState
}

export class SqliteSyncStore implements SyncStateStore {
  private readonly database: DatabaseSync

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
    this.database = new DatabaseSync(path)
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      CREATE TABLE IF NOT EXISTS sync_meta (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        revision INTEGER NOT NULL
      );
      INSERT OR IGNORE INTO sync_meta (id, revision) VALUES (1, 0);
      CREATE TABLE IF NOT EXISTS library_series (
        series_key TEXT PRIMARY KEY,
        payload TEXT,
        added_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        changed_at INTEGER NOT NULL,
        deleted INTEGER NOT NULL CHECK (deleted IN (0, 1))
      );
      CREATE TABLE IF NOT EXISTS reading_progress (
        chapter_key TEXT PRIMARY KEY,
        series_key TEXT NOT NULL,
        scroll_ratio REAL NOT NULL,
        completed INTEGER NOT NULL CHECK (completed IN (0, 1)),
        last_read_at INTEGER NOT NULL,
        changed_at INTEGER NOT NULL,
        deleted INTEGER NOT NULL CHECK (deleted IN (0, 1))
      );
      CREATE INDEX IF NOT EXISTS reading_progress_series ON reading_progress(series_key);
      CREATE TABLE IF NOT EXISTS processed_sync_operations (
        operation_id TEXT PRIMARY KEY,
        processed_at INTEGER NOT NULL
      );
    `)
  }

  close(): void {
    this.database.close()
  }

  getState(): SyncState {
    const revisionRow = this.database.prepare('SELECT revision FROM sync_meta WHERE id = 1').get() as { revision: number }
    const series = (this.database.prepare(`
      SELECT payload FROM library_series
      WHERE deleted = 0
      ORDER BY added_at ASC, series_key ASC
    `).all() as Array<{ payload: string }>).map(({ payload }) => JSON.parse(payload) as SyncedSeriesRecord)
    const progress = (this.database.prepare(`
      SELECT progress.chapter_key, progress.series_key, progress.scroll_ratio,
             progress.completed, progress.last_read_at
      FROM reading_progress AS progress
      INNER JOIN library_series AS series ON series.series_key = progress.series_key
      WHERE progress.deleted = 0 AND series.deleted = 0
      ORDER BY progress.last_read_at ASC, progress.chapter_key ASC
    `).all() as Array<{
      chapter_key: string
      series_key: string
      scroll_ratio: number
      completed: number
      last_read_at: number
    }>).map((row): SyncedProgressRecord => ({
      chapterKey: row.chapter_key,
      seriesKey: row.series_key,
      scrollRatio: row.scroll_ratio,
      completed: Boolean(row.completed),
      lastReadAt: row.last_read_at,
    }))
    return { revision: revisionRow.revision, series, progress }
  }

  applyOperations(operations: SyncOperation[]): SyncState {
    if (operations.length === 0) return this.getState()

    this.database.exec('BEGIN IMMEDIATE')
    try {
      let changed = false
      const alreadyProcessed = this.database.prepare(
        'SELECT 1 FROM processed_sync_operations WHERE operation_id = ?',
      )
      const markProcessed = this.database.prepare(
        'INSERT INTO processed_sync_operations (operation_id, processed_at) VALUES (?, ?)',
      )

      for (const operation of operations) {
        if (alreadyProcessed.get(operation.operationId)) continue
        changed = this.applyOperation(operation) || changed
        markProcessed.run(operation.operationId, Date.now())
      }

      if (changed) {
        this.database.prepare('UPDATE sync_meta SET revision = revision + 1 WHERE id = 1').run()
      }
      this.database.exec('COMMIT')
    } catch (error) {
      this.database.exec('ROLLBACK')
      throw error
    }

    return this.getState()
  }

  private applyOperation(operation: SyncOperation): boolean {
    if (operation.type === 'upsert-series') return this.upsertSeries(operation.record, operation.changedAt)
    if (operation.type === 'remove-series') return this.removeSeries(operation.seriesKey, operation.changedAt)
    return this.saveProgress(operation)
  }

  private upsertSeries(record: SyncedSeriesRecord, changedAt: number): boolean {
    const seriesKey = record.series.key
    const current = this.database.prepare(`
      SELECT payload, added_at, updated_at, changed_at, deleted
      FROM library_series WHERE series_key = ?
    `).get(seriesKey) as SeriesRow | undefined
    if (current && changedAt < current.changed_at) return false

    const canonicalRecord: SyncedSeriesRecord = {
      ...record,
      addedAt: current && !current.deleted ? Math.min(current.added_at, record.addedAt) : record.addedAt,
    }
    this.database.prepare(`
      INSERT INTO library_series (
        series_key, payload, added_at, updated_at, changed_at, deleted
      ) VALUES (?, ?, ?, ?, ?, 0)
      ON CONFLICT(series_key) DO UPDATE SET
        payload = excluded.payload,
        added_at = excluded.added_at,
        updated_at = excluded.updated_at,
        changed_at = excluded.changed_at,
        deleted = 0
    `).run(
      seriesKey,
      JSON.stringify(canonicalRecord),
      canonicalRecord.addedAt,
      canonicalRecord.updatedAt,
      changedAt,
    )

    const chapterKeys = new Set(canonicalRecord.series.chapters.map((chapter) => chapter.key))
    const storedProgress = this.database.prepare(`
      SELECT chapter_key, changed_at FROM reading_progress
      WHERE series_key = ? AND deleted = 0
    `).all(seriesKey) as Array<{ chapter_key: string; changed_at: number }>
    const tombstoneProgress = this.database.prepare(`
      UPDATE reading_progress SET deleted = 1, changed_at = ?
      WHERE chapter_key = ? AND changed_at <= ?
    `)
    for (const progress of storedProgress) {
      if (!chapterKeys.has(progress.chapter_key)) {
        tombstoneProgress.run(changedAt, progress.chapter_key, changedAt)
      }
    }
    return true
  }

  private removeSeries(seriesKey: string, changedAt: number): boolean {
    const current = this.database.prepare(`
      SELECT payload, added_at, updated_at, changed_at, deleted
      FROM library_series WHERE series_key = ?
    `).get(seriesKey) as SeriesRow | undefined
    if (current && changedAt < current.changed_at) return false
    if (current?.deleted && changedAt === current.changed_at) return false

    this.database.prepare(`
      INSERT INTO library_series (
        series_key, payload, added_at, updated_at, changed_at, deleted
      ) VALUES (?, NULL, 0, 0, ?, 1)
      ON CONFLICT(series_key) DO UPDATE SET
        payload = NULL,
        changed_at = excluded.changed_at,
        deleted = 1
    `).run(seriesKey, changedAt)
    this.database.prepare(`
      UPDATE reading_progress SET deleted = 1, changed_at = ?
      WHERE series_key = ? AND changed_at <= ?
    `).run(changedAt, seriesKey, changedAt)
    return true
  }

  private saveProgress(operation: SaveProgressOperation): boolean {
    const progress = operation.record
    const series = this.database.prepare(`
      SELECT changed_at, deleted FROM library_series WHERE series_key = ?
    `).get(progress.seriesKey) as Pick<SeriesRow, 'changed_at' | 'deleted'> | undefined
    if (series?.deleted && series.changed_at >= progress.lastReadAt) return false

    const current = this.database.prepare(`
      SELECT series_key, scroll_ratio, completed, last_read_at, changed_at, deleted
      FROM reading_progress WHERE chapter_key = ?
    `).get(progress.chapterKey) as ProgressRow | undefined
    if (current && progress.lastReadAt < current.changed_at) {
      if (progress.completed && !current.completed && !current.deleted) {
        this.database.prepare(`
          UPDATE reading_progress SET completed = 1 WHERE chapter_key = ?
        `).run(progress.chapterKey)
        return true
      }
      return false
    }

    this.database.prepare(`
      INSERT INTO reading_progress (
        chapter_key, series_key, scroll_ratio, completed,
        last_read_at, changed_at, deleted
      ) VALUES (?, ?, ?, ?, ?, ?, 0)
      ON CONFLICT(chapter_key) DO UPDATE SET
        series_key = excluded.series_key,
        scroll_ratio = excluded.scroll_ratio,
        completed = MAX(reading_progress.completed, excluded.completed),
        last_read_at = excluded.last_read_at,
        changed_at = excluded.changed_at,
        deleted = 0
    `).run(
      progress.chapterKey,
      progress.seriesKey,
      progress.scrollRatio,
      progress.completed ? 1 : 0,
      progress.lastReadAt,
      progress.lastReadAt,
    )
    return true
  }
}
