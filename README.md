# LN Reader

A web-based Japanese light novel reader designed to make reading in Japanese a seamless experience with instant word lookups, dictionary integration, and translation support.

## Features

### Reading Experience
- **EPUB Support** - Import and read EPUB files with automatic metadata extraction
- **Multiple Reading Modes** - Horizontal (LTR) and vertical (RTL) Japanese-style reading
- **Customizable Display** - Adjustable font size, line height, and dark/light themes
- **Touch & Keyboard Navigation** - Swipe gestures and arrow key support
- **Reading Progress** - Automatic position saving per book and chapter

### Japanese Language Learning
- **Instant Word Lookup** - Click any word to see its definition
- **JMDict Dictionary** - Full Japanese-English dictionary with 300k+ entries
- **Furigana Generation** - Automatic reading annotations for kanji
- **Verb Deinflection** - Finds dictionary forms of conjugated words
- **Sentence Translation** - Optional DeepL-powered translation of full sentences

### Library Management
- **Personal Library** - Upload and organize your EPUB collection
- **Cover Display** - Automatic cover image extraction
- **Offline Storage** - Books stored locally in your browser

## Tech Stack

- Next.js 16 (App Router, React 19)
- TypeScript
- Tailwind CSS 4
- shadcn/ui components
- Dexie (IndexedDB)
- Kuroshiro + Kuromoji (morphological analysis)

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) runtime

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/ln-reader.git
cd ln-reader

# Install dependencies
bun install

# Start development server
bun dev
```

The app will be available at `http://localhost:3000`.

### Environment Variables (Optional)

For sentence translation support, create a `.env.local` file:

```env
DEEPL_API_KEY=your-deepl-api-key
```

Translation is an optional feature - the app works fully without it.

## Usage

1. **Import Books** - Click the upload button to add EPUB files to your library
2. **Import Dictionary** - Use the dictionary button to download JMDict (one-time, ~15MB)
3. **Read** - Click a book to open the reader
4. **Look Up Words** - Click any word while reading to see definitions and translations
5. **Adjust Settings** - Access reader settings for theme, font size, and reading direction

## Development

```bash
bun dev      # Start development server
bun build    # Production build
bun lint     # Run ESLint
```

## Acknowledgments

- [JMDict](https://www.edrdg.org/jmdict/j_jmdict.html) - Japanese-English dictionary data
- [Kuroshiro](https://github.com/hexenq/kuroshiro) - Japanese morphological analysis
- [DeepL](https://www.deepl.com/) - Translation API
