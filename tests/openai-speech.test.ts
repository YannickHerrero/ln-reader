import { describe, expect, it, vi } from 'vitest'
import { OpenAISpeechProvider } from '../server/audio/openai-speech'

describe('OpenAI speech provider', () => {
  it('sends the configured single-narrator request without exposing the key in content', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { 'Content-Type': 'audio/mpeg' },
    }))
    const provider = new OpenAISpeechProvider({
      apiKey: 'secret-test-key',
      model: 'gpt-4o-mini-tts',
      voice: 'coral',
      instructions: 'Narration française fidèle.',
      fetcher: fetcher as unknown as typeof fetch,
    })

    const result = await provider.synthesize('Bonjour le monde.')

    expect(result).toEqual(Buffer.from([1, 2, 3]))
    expect(fetcher).toHaveBeenCalledOnce()
    const [url, options] = fetcher.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.openai.com/v1/audio/speech')
    expect(new Headers(options.headers).get('Authorization')).toBe('Bearer secret-test-key')
    const body = JSON.parse(String(options.body)) as Record<string, unknown>
    expect(body).toMatchObject({
      model: 'gpt-4o-mini-tts',
      voice: 'coral',
      input: 'Bonjour le monde.',
      instructions: 'Narration française fidèle.',
      response_format: 'mp3',
    })
    expect(JSON.stringify(body)).not.toContain('secret-test-key')
  })

  it('surfaces OpenAI error messages without accepting an empty response', async () => {
    const failingFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { message: 'Voice unavailable.' },
    }), { status: 400 }))
    const emptyFetch = vi.fn().mockResolvedValue(new Response(new Uint8Array(), { status: 200 }))

    await expect(new OpenAISpeechProvider({
      apiKey: 'test',
      fetcher: failingFetch as unknown as typeof fetch,
    }).synthesize('Texte')).rejects.toThrow('Voice unavailable')
    await expect(new OpenAISpeechProvider({
      apiKey: 'test',
      fetcher: emptyFetch as unknown as typeof fetch,
    }).synthesize('Texte')).rejects.toThrow('empty audio')
  })
})
