import { loadEpubBook } from 'epubix'

export interface ParsedEpubMetadata {
  title: string
  author: string
  coverUrl: string | null
}

export async function parseEpubMetadata(file: File): Promise<ParsedEpubMetadata> {
  try {
    const epub = await loadEpubBook(file)

    const title = epub.metadata?.title || file.name.replace(/\.epub$/i, '')
    const author = epub.metadata?.author || 'Unknown Author'

    // Use getCoverImageData() to get the cover as a data URL
    const coverUrl = await epub.getCoverImageData()

    return { title, author, coverUrl }
  } catch (error) {
    console.error('Failed to parse EPUB metadata:', error)
    // Fallback to filename
    return {
      title: file.name.replace(/\.epub$/i, ''),
      author: 'Unknown Author',
      coverUrl: null,
    }
  }
}
