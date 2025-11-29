export async function GET() {
  const available = !!process.env.DEEPL_API_KEY
  return Response.json({ available })
}
