import { createHash } from 'node:crypto'

interface NamedItem {
  label: string
  content: string
}

export function accordionGroupName(items: readonly NamedItem[], name?: string): string {
  if (name !== undefined && name.trim() !== '') return name
  const fingerprint = JSON.stringify(items.map(({ label, content }) => [label, content]))
  return `accordion-${createHash('sha256').update(fingerprint, 'utf8').digest('hex').slice(0, 8)}`
}
