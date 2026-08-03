import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type {
  AudiobookManifest,
  AudiobookSegment,
  SourceChapterContent,
} from '../../shared/contracts'
import type { SpeechProvider } from './openai-speech'

interface NarrationSegment extends AudiobookSegment {
  text: string
}

export interface AudiobookLibrary {
  request(content: SourceChapterContent): Promise<AudiobookManifest>
  manifest(id: string): Promise<AudiobookManifest | null>
  segmentPath(id: string, index: number): Promise<string | null>
}

interface AudiobookServiceOptions {
  rootPath: string
  provider: SpeechProvider
  maxCharactersPerSegment?: number
}

const DISCLOSURE = 'Narration générée par une voix artificielle OpenAI.'
const CACHE_VERSION = 1
const VALID_ID = /^[a-f0-9]{64}$/

function normalizeText(value: string): string {
  return value.replace(/\u00a0/g, ' ').replace(/\s+/gu, ' ').trim()
}

function splitToFit(value: string, maximum: number): string[] {
  const parts: string[] = []
  let remaining = normalizeText(value)
  while (remaining.length > maximum) {
    const window = remaining.slice(0, maximum + 1)
    const boundaryCandidates = [
      window.lastIndexOf('. '),
      window.lastIndexOf('! '),
      window.lastIndexOf('? '),
      window.lastIndexOf('… '),
      window.lastIndexOf('» '),
      window.lastIndexOf(' '),
    ]
    const preferred = Math.max(...boundaryCandidates)
    const boundary = preferred >= Math.floor(maximum * 0.5) ? preferred + 1 : maximum
    const part = normalizeText(remaining.slice(0, boundary))
    if (part) parts.push(part)
    remaining = normalizeText(remaining.slice(boundary))
  }
  if (remaining) parts.push(remaining)
  return parts
}

export function audiobookNarrationSegments(
  content: SourceChapterContent,
  maxCharactersPerSegment = 3_200,
): NarrationSegment[] {
  const maximum = Math.max(500, maxCharactersPerSegment)
  const bodyParts = (content.blocks ?? [])
    .filter((block) => block.kind !== 'divider')
    .flatMap((block) => splitToFit(block.text, maximum))
    .filter(Boolean)
  if (bodyParts.length === 0) throw new Error('The chapter does not contain readable text for narration.')

  const totalCharacters = bodyParts.reduce((sum, part) => sum + part.length, 0)
  const narrationParts = [normalizeText(content.title), ...bodyParts].filter(Boolean)
  const segments: NarrationSegment[] = []
  let currentParts: string[] = []
  let currentBodyCharacters = 0
  let consumedBodyCharacters = 0

  const flush = () => {
    if (currentParts.length === 0) return
    const progressStart = consumedBodyCharacters / totalCharacters
    consumedBodyCharacters += currentBodyCharacters
    const progressEnd = consumedBodyCharacters / totalCharacters
    const index = segments.length
    segments.push({
      index,
      text: currentParts.join('\n\n'),
      url: `/api/audio/chapters/__ID__/segments/${index}`,
      progressStart,
      progressEnd,
    })
    currentParts = []
    currentBodyCharacters = 0
  }

  narrationParts.forEach((part, index) => {
    const separatorLength = currentParts.length > 0 ? 2 : 0
    const currentLength = currentParts.reduce((sum, item) => sum + item.length, 0) + Math.max(0, currentParts.length - 1) * 2
    if (currentParts.length > 0 && currentLength + separatorLength + part.length > maximum) flush()
    currentParts.push(part)
    if (index > 0) currentBodyCharacters += part.length
  })
  flush()

  if (segments.length > 0 && segments[segments.length - 1]!.progressEnd < 1) {
    segments[segments.length - 1]!.progressEnd = 1
  }
  return segments
}

export class AudiobookService implements AudiobookLibrary {
  private readonly rootPath: string
  private readonly provider: SpeechProvider
  private readonly maxCharactersPerSegment: number
  private readonly activeJobs = new Map<string, Promise<void>>()
  private queueTail: Promise<void> = Promise.resolve()

  constructor(options: AudiobookServiceOptions) {
    this.rootPath = resolve(options.rootPath)
    this.provider = options.provider
    this.maxCharactersPerSegment = options.maxCharactersPerSegment ?? 3_200
  }

  async request(content: SourceChapterContent): Promise<AudiobookManifest> {
    const narration = audiobookNarrationSegments(content, this.maxCharactersPerSegment)
    const contentHash = createHash('sha256')
      .update(JSON.stringify({ title: content.title, blocks: content.blocks ?? [] }))
      .digest('hex')
    const id = createHash('sha256').update(JSON.stringify({
      cacheVersion: CACHE_VERSION,
      chapterKey: content.key,
      contentHash,
      provider: this.provider.provider,
      model: this.provider.model,
      voice: this.provider.voice,
      format: this.provider.format,
      instructions: this.provider.instructions,
    })).digest('hex')

    const cached = await this.readManifest(id)
    if (cached?.status === 'ready' && await this.hasAllSegments(cached)) return cached
    if (this.activeJobs.has(id) && cached) return cached

    const segments = narration.map((segment) => ({
      index: segment.index,
      url: segment.url.replace('__ID__', id),
      progressStart: segment.progressStart,
      progressEnd: segment.progressEnd,
    }))
    const manifest: AudiobookManifest = {
      id,
      chapterKey: content.key,
      chapterTitle: content.title,
      contentHash,
      status: 'queued',
      provider: this.provider.provider,
      model: this.provider.model,
      voice: this.provider.voice,
      format: this.provider.format,
      generatedSegments: await this.existingSegmentCount(id, segments.length),
      totalSegments: segments.length,
      segments,
      disclosure: DISCLOSURE,
    }
    await this.writeManifest(manifest)
    this.enqueue(manifest, narration)
    return manifest
  }

  async manifest(id: string): Promise<AudiobookManifest | null> {
    if (!VALID_ID.test(id)) return null
    return this.readManifest(id)
  }

  async segmentPath(id: string, index: number): Promise<string | null> {
    if (!VALID_ID.test(id) || !Number.isSafeInteger(index) || index < 0) return null
    const manifest = await this.readManifest(id)
    if (!manifest || index >= manifest.totalSegments) return null
    const path = this.segmentFile(id, index)
    return await this.fileExists(path) ? path : null
  }

  private enqueue(manifest: AudiobookManifest, narration: NarrationSegment[]): void {
    const operation = this.queueTail.then(() => this.generate(manifest, narration))
    this.queueTail = operation.catch(() => undefined)
    this.activeJobs.set(manifest.id, operation)
    operation.then(
      () => this.activeJobs.delete(manifest.id),
      () => this.activeJobs.delete(manifest.id),
    )
  }

  private async generate(initial: AudiobookManifest, narration: NarrationSegment[]): Promise<void> {
    let manifest: AudiobookManifest = { ...initial, status: 'generating', error: undefined }
    await this.writeManifest(manifest)
    try {
      for (const segment of narration) {
        const path = this.segmentFile(manifest.id, segment.index)
        if (!await this.fileExists(path)) {
          const audio = await this.provider.synthesize(segment.text)
          await this.writeAtomically(path, audio)
        }
        manifest = {
          ...manifest,
          generatedSegments: Math.max(manifest.generatedSegments, segment.index + 1),
        }
        await this.writeManifest(manifest)
      }
      manifest = {
        ...manifest,
        status: 'ready',
        generatedSegments: manifest.totalSegments,
      }
      await this.writeManifest(manifest)
    } catch (error) {
      console.error('Audiobook generation failed:', error)
      await this.writeManifest({
        ...manifest,
        status: 'failed',
        error: 'La génération de la narration a échoué. Réessayez dans quelques instants.',
      })
    }
  }

  private async readManifest(id: string): Promise<AudiobookManifest | null> {
    try {
      return JSON.parse(await readFile(this.manifestFile(id), 'utf8')) as AudiobookManifest
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  }

  private async writeManifest(manifest: AudiobookManifest): Promise<void> {
    await this.writeAtomically(this.manifestFile(manifest.id), JSON.stringify(manifest, null, 2))
  }

  private async writeAtomically(path: string, value: string | Buffer): Promise<void> {
    await mkdir(dirname(path), { recursive: true })
    const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`
    await writeFile(temporary, value)
    await rename(temporary, path)
  }

  private async hasAllSegments(manifest: AudiobookManifest): Promise<boolean> {
    return (await this.existingSegmentCount(manifest.id, manifest.totalSegments)) === manifest.totalSegments
  }

  private async existingSegmentCount(id: string, count: number): Promise<number> {
    let existing = 0
    for (let index = 0; index < count; index += 1) {
      if (await this.fileExists(this.segmentFile(id, index))) existing += 1
    }
    return existing
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      return (await stat(path)).isFile()
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
      throw error
    }
  }

  private manifestFile(id: string): string {
    return resolve(this.rootPath, id, 'manifest.json')
  }

  private segmentFile(id: string, index: number): string {
    return resolve(this.rootPath, id, `${String(index).padStart(4, '0')}.${this.provider.format}`)
  }
}
