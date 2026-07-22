import sanitizeHtml from 'sanitize-html'

const allowedTags = ['p', 'br', 'strong', 'em', 'b', 'i', 'blockquote', 'hr', 'ul', 'ol', 'li', 'h2', 'h3']

export function sanitizeChapterHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags,
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
  }).trim()
}
