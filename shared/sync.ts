import type { SourceChapter, SourceReference, SourceSeries } from './contracts'

export interface SyncedSeriesRecord {
  series: SourceSeries
  addedAt: number
  updatedAt: number
}

export interface SyncedProgressRecord {
  chapterKey: string
  seriesKey: string
  scrollRatio: number
  completed: boolean
  lastReadAt: number
}

export interface UpsertSeriesOperation {
  operationId: string
  type: 'upsert-series'
  changedAt: number
  record: SyncedSeriesRecord
}

export interface RemoveSeriesOperation {
  operationId: string
  type: 'remove-series'
  seriesKey: string
  changedAt: number
}

export interface SaveProgressOperation {
  operationId: string
  type: 'save-progress'
  record: SyncedProgressRecord
}

export type SyncOperation = UpsertSeriesOperation | RemoveSeriesOperation | SaveProgressOperation

export interface SyncRequest {
  operations: SyncOperation[]
}

export interface SyncState {
  revision: number
  series: SyncedSeriesRecord[]
  progress: SyncedProgressRecord[]
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid sync ${label}.`)
  }
  return value as Record<string, unknown>
}

function string(value: unknown, label: string, maximum = 10_000): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum) {
    throw new Error(`Invalid sync ${label}.`)
  }
  return value
}

function nullableString(value: unknown, label: string): string | null {
  return value === null ? null : string(value, label)
}

function timestamp(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid sync ${label}.`)
  }
  return value
}

function nullableNumber(value: unknown, label: string): number | null {
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid sync ${label}.`)
  }
  return value
}

function sourceReference(value: unknown, label: string): SourceReference {
  const input = record(value, label)
  if (input.source !== 'novelFr') throw new Error(`Invalid sync ${label}.source.`)
  return {
    source: 'novelFr',
    key: string(input.key, `${label}.key`, 4_096),
  }
}

function chapter(value: unknown, label: string): SourceChapter {
  const input = record(value, label)
  if (!Array.isArray(input.releases) || input.releases.length === 0 || input.releases.length > 10) {
    throw new Error(`Invalid sync ${label}.releases.`)
  }
  return {
    key: string(input.key, `${label}.key`, 4_096),
    title: string(input.title, `${label}.title`),
    number: nullableNumber(input.number, `${label}.number`),
    volume: nullableNumber(input.volume, `${label}.volume`),
    publishedAt: nullableString(input.publishedAt, `${label}.publishedAt`),
    releases: input.releases.map((release, index) => sourceReference(release, `${label}.releases[${index}]`)),
  }
}

function series(value: unknown, label: string): SourceSeries {
  const input = record(value, label)
  if (!Array.isArray(input.sources) || input.sources.length === 0 || input.sources.length > 10) {
    throw new Error(`Invalid sync ${label}.sources.`)
  }
  if (!Array.isArray(input.genres) || input.genres.length > 100) {
    throw new Error(`Invalid sync ${label}.genres.`)
  }
  if (!Array.isArray(input.chapters) || input.chapters.length > 10_000) {
    throw new Error(`Invalid sync ${label}.chapters.`)
  }
  return {
    key: string(input.key, `${label}.key`, 4_096),
    title: string(input.title, `${label}.title`),
    sources: input.sources.map((source, index) => sourceReference(source, `${label}.sources[${index}]`)),
    coverImage: nullableString(input.coverImage, `${label}.coverImage`),
    author: nullableString(input.author, `${label}.author`),
    description: nullableString(input.description, `${label}.description`),
    genres: input.genres.map((genre, index) => string(genre, `${label}.genres[${index}]`, 1_000)),
    status: nullableString(input.status, `${label}.status`),
    chapters: input.chapters.map((item, index) => chapter(item, `${label}.chapters[${index}]`)),
  }
}

function syncedSeries(value: unknown, label: string): SyncedSeriesRecord {
  const input = record(value, label)
  const parsedSeries = series(input.series, `${label}.series`)
  return {
    series: parsedSeries,
    addedAt: timestamp(input.addedAt, `${label}.addedAt`),
    updatedAt: timestamp(input.updatedAt, `${label}.updatedAt`),
  }
}

function syncedProgress(value: unknown, label: string): SyncedProgressRecord {
  const input = record(value, label)
  if (typeof input.scrollRatio !== 'number' || !Number.isFinite(input.scrollRatio)
    || input.scrollRatio < 0 || input.scrollRatio > 1 || typeof input.completed !== 'boolean') {
    throw new Error(`Invalid sync ${label}.`)
  }
  return {
    chapterKey: string(input.chapterKey, `${label}.chapterKey`, 4_096),
    seriesKey: string(input.seriesKey, `${label}.seriesKey`, 4_096),
    scrollRatio: input.scrollRatio,
    completed: input.completed,
    lastReadAt: timestamp(input.lastReadAt, `${label}.lastReadAt`),
  }
}

function operation(value: unknown, index: number): SyncOperation {
  const label = `operation[${index}]`
  const input = record(value, label)
  const operationId = string(input.operationId, `${label}.operationId`, 128)
  if (input.type === 'upsert-series') {
    const parsedRecord = syncedSeries(input.record, `${label}.record`)
    return {
      operationId,
      type: 'upsert-series',
      changedAt: timestamp(input.changedAt, `${label}.changedAt`),
      record: parsedRecord,
    }
  }
  if (input.type === 'remove-series') {
    return {
      operationId,
      type: 'remove-series',
      seriesKey: string(input.seriesKey, `${label}.seriesKey`, 4_096),
      changedAt: timestamp(input.changedAt, `${label}.changedAt`),
    }
  }
  if (input.type === 'save-progress') {
    return {
      operationId,
      type: 'save-progress',
      record: syncedProgress(input.record, `${label}.record`),
    }
  }
  throw new Error(`Invalid sync ${label}.type.`)
}

export function parseSyncRequest(value: unknown): SyncRequest {
  const input = record(value, 'request')
  if (!Array.isArray(input.operations) || input.operations.length > 1_000) {
    throw new Error('Invalid sync request.operations.')
  }
  return { operations: input.operations.map(operation) }
}

export function parseSyncState(value: unknown): SyncState {
  const input = record(value, 'state')
  if (!Array.isArray(input.series) || input.series.length > 10_000
    || !Array.isArray(input.progress) || input.progress.length > 100_000) {
    throw new Error('Invalid sync state collections.')
  }
  return {
    revision: timestamp(input.revision, 'state.revision'),
    series: input.series.map((item, index) => syncedSeries(item, `state.series[${index}]`)),
    progress: input.progress.map((item, index) => syncedProgress(item, `state.progress[${index}]`)),
  }
}
