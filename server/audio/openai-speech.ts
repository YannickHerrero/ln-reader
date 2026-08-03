export interface SpeechProvider {
  readonly provider: string
  readonly model: string
  readonly voice: string
  readonly format: 'mp3'
  readonly instructions: string
  synthesize(input: string): Promise<Buffer>
}

interface OpenAISpeechProviderOptions {
  apiKey: string
  model?: string
  voice?: string
  instructions?: string
  fetcher?: typeof fetch
}

const DEFAULT_INSTRUCTIONS = [
  "Lis ce texte en français comme un narrateur professionnel de livre audio.",
  "Adopte un ton naturel, chaleureux et immersif, avec une diction nette et des pauses discrètes.",
  "Respecte fidèlement le texte sans ajouter, retirer, reformuler ni commenter quoi que ce soit.",
  "Garde une voix et un rythme cohérents pendant toute la narration.",
].join(' ')

export class OpenAISpeechProvider implements SpeechProvider {
  readonly provider = 'openai'
  readonly model: string
  readonly voice: string
  readonly format = 'mp3' as const
  readonly instructions: string

  private readonly apiKey: string
  private readonly fetcher: typeof fetch

  constructor(options: OpenAISpeechProviderOptions) {
    this.apiKey = options.apiKey.trim()
    if (!this.apiKey) throw new Error('OPENAI_API_KEY must not be empty.')
    this.model = options.model?.trim() || 'gpt-4o-mini-tts'
    this.voice = options.voice?.trim() || 'coral'
    this.instructions = options.instructions?.trim() || DEFAULT_INSTRUCTIONS
    this.fetcher = options.fetcher ?? fetch
  }

  async synthesize(input: string): Promise<Buffer> {
    const normalized = input.trim()
    if (!normalized) throw new Error('OpenAI speech input must not be empty.')

    const response = await this.fetcher('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        voice: this.voice,
        input: normalized,
        instructions: this.instructions,
        response_format: this.format,
      }),
      signal: AbortSignal.timeout(120_000),
    })

    if (!response.ok) {
      const body = await response.text()
      let detail = body
      try {
        const parsed = JSON.parse(body) as { error?: { message?: unknown } }
        if (typeof parsed.error?.message === 'string') detail = parsed.error.message
      } catch {
        // Preserve the response body when OpenAI does not return JSON.
      }
      throw new Error(`OpenAI speech returned HTTP ${response.status}: ${detail || response.statusText}`)
    }

    const audio = Buffer.from(await response.arrayBuffer())
    if (audio.length === 0) throw new Error('OpenAI speech returned an empty audio response.')
    return audio
  }
}
