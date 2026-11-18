import { describe, expect, it } from 'vitest'

import { activeHeadingId, progressPercent, tocEntries } from '../toc'

describe('tocEntries', () => {
  it('keeps the ## and ### headings in order and drops the rest', () => {
    const entries = tocEntries([
      { depth: 1, slug: 'title', text: 'Title' },
      { depth: 2, slug: 'what-it-does', text: 'What it does' },
      { depth: 3, slug: 'one-svg', text: 'One SVG' },
      { depth: 4, slug: 'detail', text: 'Detail' },
      { depth: 2, slug: 'going-further', text: 'Going further' },
    ])

    expect(entries).toEqual([
      { depth: 2, slug: 'what-it-does', text: 'What it does' },
      { depth: 3, slug: 'one-svg', text: 'One SVG' },
      { depth: 2, slug: 'going-further', text: 'Going further' },
    ])
  })

  it('drops headings without a slug, since nothing could link to them', () => {
    expect(tocEntries([{ depth: 2, slug: '', text: 'Untitled' }])).toEqual([])
  })
})

describe('activeHeadingId', () => {
  const positions = [
    { id: 'a', top: -400 },
    { id: 'b', top: 60 },
    { id: 'c', top: 700 },
  ]

  it('marks the last heading that has scrolled past the offset', () => {
    expect(activeHeadingId(positions, 120)).toBe('b')
  })

  it('marks the first heading while none has reached the offset', () => {
    expect(activeHeadingId([{ id: 'a', top: 300 }], 120)).toBe('a')
  })

  it('returns nothing when the page has no headings', () => {
    expect(activeHeadingId([], 120)).toBeUndefined()
  })
})

describe('progressPercent', () => {
  it('turns a step of a path into a whole percent', () => {
    expect(progressPercent(2, 17)).toBe(12)
    expect(progressPercent(17, 17)).toBe(100)
  })

  it('stays between 0 and 100 for out-of-range input', () => {
    expect(progressPercent(5, 0)).toBe(0)
    expect(progressPercent(-1, 4)).toBe(0)
    expect(progressPercent(9, 4)).toBe(100)
  })
})
