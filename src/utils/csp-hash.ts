import { createHash } from 'node:crypto'

export function scriptHash(content: string): `sha256-${string}` {
  return `sha256-${createHash('sha256').update(content, 'utf8').digest('base64')}`
}
