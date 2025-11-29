const JMDICT_CDN_URL = 'https://github.com/yomidevs/jmdict-yomitan/releases/latest/download/JMdict_english.zip'

export async function GET() {
  const response = await fetch(JMDICT_CDN_URL)

  if (!response.ok) {
    return new Response('Failed to fetch dictionary', { status: response.status })
  }

  const blob = await response.blob()

  return new Response(blob, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="JMdict_english.zip"',
    },
  })
}
