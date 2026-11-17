// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { toGuideRefs } from '../guide-entries'

import type { GuideData } from '@content/schema'

const data = (overrides: Partial<GuideData> = {}): GuideData => ({
  title: 'What is a mod',
  description: 'The files of a mod.',
  route: 'mods',
  order: 1,
  updated: new Date('2026-11-17'),
  verifiedWith: '2.1.325',
  sources: [],
  draft: false,
  ...overrides,
})

describe('toGuideRefs', () => {
  it('keeps the entry and copies the fields navigation needs', () => {
    const entry = { id: 'es/mods/what-is-a-mod', data: data({ order: 2, title: 'Qué es' }) }
    expect(toGuideRefs([entry])).toEqual([
      {
        id: 'es/mods/what-is-a-mod',
        locale: 'es',
        route: 'mods',
        slug: 'what-is-a-mod',
        order: 2,
        draft: false,
        title: 'Qué es',
        entry,
      },
    ])
  })

  it('drops entries outside locale/route/slug and entries whose route disagrees with the folder', () => {
    const entries = [
      { id: 'de/mods/a', data: data() },
      { id: 'en/pet/a', data: data({ route: 'mods' }) },
    ]
    expect(toGuideRefs(entries)).toEqual([])
  })
})
