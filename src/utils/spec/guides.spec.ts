// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  guideHref,
  guideNeighbors,
  type GuideRef,
  guidesFor,
  missingTranslations,
  parseGuideId,
  routeHref,
  sourceLabel,
  sourceLicenses,
  sourceUrl,
} from '../guides'

const ref = (id: string, order: number, draft = false): GuideRef => {
  const parsed = parseGuideId(id)
  if (parsed === undefined) throw new Error(`Bad id ${id}`)
  return { ...parsed, id, order, draft, title: id }
}

describe('parseGuideId', () => {
  it('splits a collection id into locale, route, and slug', () => {
    expect(parseGuideId('es/mods/what-is-a-mod')).toEqual({
      locale: 'es',
      route: 'mods',
      slug: 'what-is-a-mod',
    })
  })

  it('rejects unknown locales, unknown routes, and ids with the wrong depth', () => {
    expect(parseGuideId('de/mods/a')).toBeUndefined()
    expect(parseGuideId('en/games/a')).toBeUndefined()
    expect(parseGuideId('en/mods')).toBeUndefined()
    expect(parseGuideId('en/mods/a/b')).toBeUndefined()
    expect(parseGuideId('en/mods/')).toBeUndefined()
  })
})

describe('routeHref and guideHref', () => {
  it('puts the fundamentals and both mod paths under /mods/ and the bot under /bot/', () => {
    expect(routeHref('en', 'mods')).toBe('/en/mods/')
    expect(routeHref('es', 'pet')).toBe('/es/mods/pet/')
    expect(routeHref('fr', 'check')).toBe('/fr/mods/check/')
    expect(routeHref('pt', 'bot')).toBe('/pt/bot/')
    expect(routeHref('it', 'android')).toBe('/it/android/')
    expect(routeHref('en', 'watch')).toBe('/en/watch/')
    expect(guideHref('it', 'mods', 'the-dollar-object')).toBe('/it/mods/the-dollar-object/')
    expect(guideHref('en', 'pet', 'states')).toBe('/en/mods/pet/states/')
  })
})

describe('guidesFor', () => {
  const guides = [
    ref('en/mods/c', 3),
    ref('en/mods/a', 1),
    ref('es/mods/a', 1),
    ref('en/pet/x', 1),
    ref('en/mods/b', 2),
    ref('en/mods/hidden', 4, true),
  ]

  it('keeps one locale and one route, ordered by order, without drafts', () => {
    expect(guidesFor(guides, 'en', 'mods').map((guide) => guide.slug)).toEqual(['a', 'b', 'c'])
  })

  it('breaks ties on order by slug', () => {
    const tied = [ref('en/mods/z', 1), ref('en/mods/m', 1)]
    expect(guidesFor(tied, 'en', 'mods').map((guide) => guide.slug)).toEqual(['m', 'z'])
  })
})

describe('guideNeighbors', () => {
  const list = [ref('en/mods/a', 1), ref('en/mods/b', 2), ref('en/mods/c', 3)]

  it('gives the previous and next guide in the path', () => {
    const { previous, next } = guideNeighbors(list, 'b')
    expect(previous?.slug).toBe('a')
    expect(next?.slug).toBe('c')
  })

  it('has no previous guide on the first one and no next guide on the last one', () => {
    expect(guideNeighbors(list, 'a').previous).toBeUndefined()
    expect(guideNeighbors(list, 'c').next).toBeUndefined()
  })

  it('has no neighbors for a slug outside the path', () => {
    expect(guideNeighbors(list, 'zzz')).toEqual({ previous: undefined, next: undefined })
  })
})

describe('missingTranslations', () => {
  it('lists every route and slug that some locale lacks', () => {
    const guides = [ref('en/mods/a', 1), ref('es/mods/a', 1), ref('en/mods/b', 2)]
    expect(missingTranslations(guides, ['en', 'es'])).toEqual(['es/mods/b'])
  })

  it('is empty when every locale has every guide', () => {
    const guides = [ref('en/mods/a', 1), ref('es/mods/a', 1)]
    expect(missingTranslations(guides, ['en', 'es'])).toEqual([])
  })
})

describe('sourceLabel', () => {
  it('names the repository and the path', () => {
    expect(sourceLabel({ repo: 'pet', path: 'hooks/xp.ts' })).toBe('narsil-pet/hooks/xp.ts')
    expect(sourceLabel({ repo: 'check', path: 'hooks/git.ts' })).toBe('narsil-check/hooks/git.ts')
    expect(sourceLabel({ repo: 'android', path: 'README.md' })).toBe('narsil-android/README.md')
    expect(sourceLabel({ repo: 'watch', path: 'README.md' })).toBe('narsil-watch/README.md')
  })
})

describe('sourceUrl', () => {
  it('links to the file on the main branch of the mod repository', () => {
    expect(sourceUrl({ repo: 'pet', path: 'hooks/register.tsx' })).toBe(
      'https://github.com/davshn/narsil-pet/blob/main/hooks/register.tsx',
    )
    expect(sourceUrl({ repo: 'check', path: 'hooks/osv.ts' })).toBe(
      'https://github.com/davshn/narsil-check/blob/main/hooks/osv.ts',
    )
    expect(sourceUrl({ repo: 'watch', path: 'app/build.gradle.kts' })).toBe(
      'https://github.com/davshn/narsil-watch/blob/main/app/build.gradle.kts',
    )
  })
})

describe('sourceLicenses', () => {
  it('names each license once, in the order the sources first use it', () => {
    expect(
      sourceLicenses(
        [
          { repo: 'pet', path: 'hooks/phone.ts' },
          { repo: 'watch', path: 'README.md' },
        ],
        'en',
      ),
    ).toBe('GPL v3')
    expect(
      sourceLicenses(
        [
          { repo: 'android', path: 'README.md' },
          { repo: 'pet', path: 'hooks/seal.ts' },
        ],
        'en',
      ),
    ).toBe('MIT and GPL v3')
  })

  it('joins the licenses in the language of the page', () => {
    expect(
      sourceLicenses(
        [
          { repo: 'android', path: 'README.md' },
          { repo: 'check', path: 'hooks/osv.ts' },
        ],
        'es',
      ),
    ).toBe('MIT y GPL v3')
  })
})
