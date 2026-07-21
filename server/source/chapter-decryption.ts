import { createDecipheriv, pbkdf2Sync } from 'node:crypto'

export interface EncryptedChapter {
  encrypted: string
  iv: string
  tag: string
  token: string
}

export function decryptChapter({ encrypted, iv, tag, token }: EncryptedChapter): string {
  const key = pbkdf2Sync(token, 'novel-protect', 50_000, 32, 'sha256')
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}
