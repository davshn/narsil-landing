export interface Heading {
  depth: number
  slug: string
  text: string
}

export interface TocEntry {
  depth: 2 | 3
  slug: string
  text: string
}

export interface HeadingPosition {
  id: string
  top: number
}

const isTocDepth = (depth: number): depth is 2 | 3 => depth === 2 || depth === 3

export function tocEntries(headings: readonly Heading[]): TocEntry[] {
  return headings.flatMap(({ depth, slug, text }) =>
    isTocDepth(depth) && slug !== '' ? [{ depth, slug, text }] : [],
  )
}

export function activeHeadingId(
  positions: readonly HeadingPosition[],
  offset: number,
): string | undefined {
  let active = positions[0]?.id
  for (const { id, top } of positions) {
    if (top > offset) break
    active = id
  }
  return active
}

export function progressPercent(step: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((Math.min(Math.max(step, 0), total) / total) * 100)
}
