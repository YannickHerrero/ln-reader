import { loadEpubBook } from 'epubix'
import { countHtmlCharacters } from '@/lib/pagination/get-character-count'

export interface ParsedEpubMetadata {
  title: string
  author: string
  coverUrl: string | null
  chapterCharCounts: number[]
  totalCharCount: number
}

export async function parseEpubMetadata(file: File): Promise<ParsedEpubMetadata> {
  try {
    const epub = await loadEpubBook(file)

    const title = epub.metadata?.title || file.name.replace(/\.epub$/i, '')
    const author = epub.metadata?.author || 'Unknown Author'

    // Use getCoverImageData() to get the cover as a data URL
    const coverUrl = await epub.getCoverImageData()

    // Calculate character counts for all chapters
    const chapters = epub.chapters || []
    const chapterCharCounts: number[] = []
    let totalCharCount = 0

    for (const chapter of chapters) {
      const count = countHtmlCharacters(chapter.content)
      chapterCharCounts.push(count)
      totalCharCount += count
    }

    return { title, author, coverUrl, chapterCharCounts, totalCharCount }
  } catch (error) {
    console.error('Failed to parse EPUB metadata:', error)
    // Fallback to filename
    return {
      title: file.name.replace(/\.epub$/i, ''),
      author: 'Unknown Author',
      coverUrl: null,
      chapterCharCounts: [],
      totalCharCount: 0,
    }
  }
}
