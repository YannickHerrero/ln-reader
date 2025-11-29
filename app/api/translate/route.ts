export async function POST(request: Request) {
  const { text } = await request.json()

  if (!text) {
    return Response.json({ error: 'No text provided' }, { status: 400 })
  }

  const apiKey = process.env.DEEPL_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'DeepL API key not configured' }, { status: 500 })
  }

  try {
    const response = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: [text],
        source_lang: 'JA',
        target_lang: 'EN',
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      return Response.json({ error: `DeepL API error: ${error}` }, { status: response.status })
    }

    const data = await response.json()
    return Response.json({ translation: data.translations[0].text })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Translation failed' },
      { status: 500 }
    )
  }
}
