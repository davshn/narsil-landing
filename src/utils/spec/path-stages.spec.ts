// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { locales, pathKeys, type PathKey } from '@i18n/index'
import { useTranslations } from '@i18n/utils'

import {
  BOT_PART_GUIDES,
  botPartGuides,
  botParts,
  groupStages,
  PATH_STAGE_STARTS,
  pickGuides,
} from '../path-stages'

const guide = (
  slug: string,
  number = 0,
): { slug: string; number: number; title: string; href: string } => ({
  slug,
  number,
  title: slug,
  href: `/en/bot/${slug}/`,
})

const slugsOf = (group: ReadonlyArray<{ slug: string }>): string[] => group.map((item) => item.slug)

const ordered = ['a', 'b', 'c', 'd', 'e'].map((slug, index) => guide(slug, index + 1))

describe('groupStages', () => {
  it('splits an ordered list into contiguous stages at each start', () => {
    const groups = groupStages(ordered, ['a', 'c', 'e'])

    expect(groups.map(slugsOf)).toEqual([['a', 'b'], ['c', 'd'], ['e']])
  })

  it('leaves a stage empty when its start is missing and lets the previous stage run on', () => {
    const groups = groupStages(ordered, ['a', 'missing', 'd'])

    expect(groups.map(slugsOf)).toEqual([['a', 'b', 'c'], [], ['d', 'e']])
  })

  it('returns no stages for no starts', () => {
    expect(groupStages(ordered, [])).toEqual([])
  })
})

describe('botPartGuides', () => {
  it('gives every bot part the guides that build it, in path order', () => {
    const bot = [
      'the-bot',
      'xiaozhi-belly',
      'own-server',
      'claude-brain',
      'narsil-voice',
      'ntfy-alerts',
      'github-prs',
      'belly-ui',
      'uart-protocol',
      'holographic-head',
      'secrets-privacy',
    ].map((slug, index) => guide(slug, index + 1))
    const parts = botPartGuides(bot)

    expect(Object.keys(parts)).toEqual([...botParts])
    expect(parts.belly.map((item) => item.number)).toEqual([2, 8, 9, 11])
    expect(parts.server.map((item) => item.number)).toEqual([3, 5])
    expect(parts.claude).toEqual([
      { number: 4, title: 'claude-brain', href: '/en/bot/claude-brain/' },
    ])
    expect(parts.head.map((item) => item.number)).toEqual([10])
    expect(parts.feeds.map((item) => item.number)).toEqual([6, 7])
  })
})

describe('pickGuides', () => {
  it('keeps the guides with the given slugs in path order, without the slug', () => {
    expect(pickGuides(ordered, ['d', 'b'])).toEqual([
      { number: 2, title: 'b', href: '/en/bot/b/' },
      { number: 4, title: 'd', href: '/en/bot/d/' },
    ])
  })
})

const guidesRoot = join(process.cwd(), 'src', 'content', 'guides')

const orderedSlugs = (locale: string, route: PathKey): string[] => {
  const dir = join(guidesRoot, locale, route)
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => {
      const source = readFileSync(join(dir, name), 'utf8')
      const order = Number(/^order: (?<value>\d+)$/mv.exec(source)?.groups?.value)
      return { slug: name.replace(/\.md$/v, ''), order }
    })
    .sort((a, b) => a.order - b.order)
    .map((item) => item.slug)
}

describe('path stages against the guides', () => {
  it.each(locales.flatMap((locale) => pathKeys.map((route) => [locale, route] as const)))(
    'cover every %s guide of the %s path, in order, with no empty stage',
    (locale, route) => {
      const slugs = orderedSlugs(locale, route)
      const groups = groupStages(
        slugs.map((slug) => ({ slug })),
        PATH_STAGE_STARTS[route],
      )

      expect(slugs[0]).toBe(PATH_STAGE_STARTS[route][0])
      expect(groups.every((group) => group.length > 0)).toBe(true)
      expect(groups.flat().map((item) => item.slug)).toEqual(slugs)
    },
  )

  it('point every bot part at existing bot guides', () => {
    const slugs = orderedSlugs('en', 'bot')

    for (const part of botParts) {
      expect(BOT_PART_GUIDES[part].length).toBeGreaterThan(0)
      expect(BOT_PART_GUIDES[part].every((slug) => slugs.includes(slug))).toBe(true)
    }
  })

  it.each(locales)('have one stage text per stage in %s', (locale) => {
    const t = useTranslations(locale)

    for (const route of pathKeys) {
      expect(t[route].stages).toHaveLength(PATH_STAGE_STARTS[route].length)
    }
  })
})
