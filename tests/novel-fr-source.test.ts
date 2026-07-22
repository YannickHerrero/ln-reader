import { afterEach, describe, expect, it, vi } from 'vitest'
import { NovelFrSource } from '../server/source/novel-fr'

const seriesHtml = `
  <h1 class="entry-title">the beginning after the end</h1>
  <div class="sertostat"><span>Completed</span></div>
  <div class="sertothumb"><img src="https://i3.wp.com/novel-fr.net/wp-content/uploads/cover.png"></div>
  <div class="sertoauth"><div class="serl"><span class="sername">Auteur</span><span class="serval">TurtleMe</span></div></div>
  <div class="sersys entry-content">Synopsis</div>
  <div class="sertogenre"><a>Fantasy</a></div>
  <div class="eplister"><ul>
    <li><a href="https://novel-fr.net/demo-volume-2-chapitre-1/"><div class="epl-num">Vol. 2 Ch. 1</div><div class="epl-title">Second volume</div><div class="epl-date">août 20, 2022</div></a></li>
    <li><a href="https://novel-fr.net/demo-volume-1-chapitre-1/"><div class="epl-num">Vol. 1 Ch. 1</div><div class="epl-title">First volume</div></a></li>
    <li><a href="https://novel-fr.net/demo-volume-1-prologue/"><div class="epl-num">Vol. 1 Ch. 0</div><div class="epl-title">Prologue</div></a></li>
  </ul></div>`

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Novel-FR source', () => {
  it('parses metadata and preserves repeated chapter numbers across volumes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(seriesHtml, {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    })))

    const series = await new NovelFrSource().series('novelFr:/series/the-beginning-after-the-end/')

    expect(series).toMatchObject({
      title: 'the beginning after the end',
      author: 'TurtleMe',
      status: 'Completed',
      sources: [{ source: 'novelFr', key: 'novelFr:/series/the-beginning-after-the-end/' }],
    })
    expect(series.chapters.map((chapter) => [chapter.volume, chapter.number])).toEqual([
      [2, 1],
      [1, 1],
      [1, 0],
    ])
    expect(series.chapters[1]).toMatchObject({
      key: 'novelFr:/demo-volume-1-chapitre-1/',
      volume: 1,
      releases: [{ source: 'novelFr' }],
    })
  })

  it('sanitizes chapter content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(`
      <h1 class="entry-title">Chapitre 32</h1>
      <div class="entry-content epcontent"><p>Texte</p><script>alert(1)</script></div>
    `, { status: 200 })))

    const content = await new NovelFrSource().chapter('novelFr:/the-beginning-after-the-end-chapitre-32/')

    expect(content).toEqual({
      key: 'novelFr:/the-beginning-after-the-end-chapitre-32/',
      title: 'Chapitre 32',
      html: '<p>Texte</p>',
      source: 'novelFr',
    })
  })
})
