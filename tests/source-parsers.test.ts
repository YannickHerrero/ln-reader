import { createCipheriv, pbkdf2Sync } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  parseChapterContent,
  parseChapters,
  parseSearchResponse,
  parseSeriesDetails,
} from '../server/source/parsers'

function encryptedAttributes(html: string) {
  const token = 'test-token'
  const iv = Buffer.from('00112233445566778899aabb', 'hex')
  const key = pbkdf2Sync(token, 'novel-protect', 50_000, 32, 'sha256')
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(html), cipher.final()])
  return {
    encrypted: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    token,
  }
}

describe('Mangas-Origines parsers', () => {
  it('keeps text series and rejects manga suggestions', () => {
    const results = parseSearchResponse({
      success: true,
      data: [
        { title: 'The Novel’s Extra', url: 'https://mangas-origines.fr/oeuvre/the-novels-extra/', type: 'manga' },
        { title: 'Toradora!', url: 'https://mangas-origines.fr/oeuvre/toradora/', type: 'text' },
        { title: 'Off site', url: 'https://example.com/novel/', type: 'text' },
      ],
    })

    expect(results).toEqual([
      { key: '/oeuvre/toradora/', title: 'Toradora!', sourceType: 'text' },
    ])
  })

  it('parses series metadata and decimal chapter numbers', () => {
    const detail = `
      <div class="post-title"><h1>Example Novel</h1></div>
      <div class="summary_image"><img data-src=" /wp-content/uploads/cover.webp "></div>
      <div class="author-content"><a>Jane Doe</a></div>
      <div class="genres-content"><a>Novel</a><a>Fantasy</a></div>
      <div class="description-summary"><div class="summary__content"> A short synopsis. </div></div>
      <div class="post-content_item">
        <div class="summary-heading"><h5>État :</h5></div>
        <div class="summary-content">En cours</div>
      </div>`
    const chapters = `
      <li class="wp-manga-chapter"><a href="https://mangas-origines.fr/oeuvre/example/chapitre-10-5/">Chapitre 10.5</a><span class="chapter-release-date">12 mars 2024</span></li>
      <li class="wp-manga-chapter"><a href="https://mangas-origines.fr/oeuvre/example/chapitre-9/">Chapitre 9</a></li>`

    expect(parseSeriesDetails(detail, '/oeuvre/example/', chapters)).toMatchObject({
      title: 'Example Novel',
      coverImage: 'https://mangas-origines.fr/wp-content/uploads/cover.webp',
      author: 'Jane Doe',
      description: 'A short synopsis.',
      genres: ['Novel', 'Fantasy'],
      status: 'En cours',
      chapters: [
        { number: 10.5, publishedAt: '12 mars 2024' },
        { number: 9, publishedAt: null },
      ],
    })
    expect(parseChapters(chapters)).toHaveLength(2)
  })

  it('decrypts and sanitizes protected chapter HTML', () => {
    const encrypted = encryptedAttributes('<p>Bonjour <strong>lecteur</strong>.</p><script>alert(1)</script>')
    const page = `
      <h1 id="chapter-heading">Chapitre 4</h1>
      <div class="chapter-content-protected"
        data-enc="${encrypted.encrypted}"
        data-iv="${encrypted.iv}"
        data-tag="${encrypted.tag}"
        data-token="${encrypted.token}"></div>`

    expect(parseChapterContent(page, '/oeuvre/example/chapitre-4/')).toEqual({
      key: '/oeuvre/example/chapitre-4/',
      title: 'Chapitre 4',
      html: '<p>Bonjour <strong>lecteur</strong>.</p>',
    })
  })
})
