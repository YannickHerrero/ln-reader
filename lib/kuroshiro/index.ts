import Kuroshiro from 'kuroshiro'
import KuromojiAnalyzer from 'kuroshiro-analyzer-kuromoji'

let instance: Kuroshiro | null = null
let initPromise: Promise<Kuroshiro> | null = null

// Use CDN for dictionary files
const DICT_PATH = 'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/'

export async function getKuroshiro(): Promise<Kuroshiro> {
  if (instance) return instance
  if (initPromise) return initPromise

  initPromise = (async () => {
    const kuroshiro = new Kuroshiro()
    await kuroshiro.init(new KuromojiAnalyzer({
      dictPath: DICT_PATH
    }))
    instance = kuroshiro
    return instance
  })()

  return initPromise
}

export async function addFurigana(text: string): Promise<string> {
  const kuroshiro = await getKuroshiro()
  return kuroshiro.convert(text, {
    mode: 'furigana',
    to: 'hiragana'
  })
}
