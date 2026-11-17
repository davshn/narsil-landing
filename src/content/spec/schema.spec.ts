// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

import { guideSchema } from '@content/schema'
import { locales } from '@i18n/index'
import { type GuideRef, missingTranslations, parseGuideId } from '@utils/guides'

const valid = {
  title: 'What is a mod',
  description: 'The files a Claude Code mod is made of.',
  route: 'mods',
  order: 1,
  updated: '2026-11-17',
  verifiedWith: '2.1.325',
  sources: [{ repo: 'pet', path: 'hooks/register.tsx' }],
}

describe('guideSchema', () => {
  it('accepts a complete guide and turns the date into a Date', () => {
    const guide = guideSchema.parse(valid)
    expect(guide.updated).toBeInstanceOf(Date)
    expect(guide.draft).toBe(false)
  })

  it('accepts root files and nested paths with dots', () => {
    ;[
      'README.md',
      'overlay/server.cjs',
      'docs/plan-advice.md',
      '.claude-plugin/plugin.json',
    ].forEach((path) => {
      expect(guideSchema.safeParse({ ...valid, sources: [{ repo: 'pet', path }] }).success).toBe(
        true,
      )
    })
  })

  it('defaults sources to an empty list', () => {
    const { sources: _sources, ...rest } = valid
    expect(guideSchema.parse(rest).sources).toEqual([])
  })

  it('rejects an unknown route, repository, or a version that is not x.y.z', () => {
    expect(guideSchema.safeParse({ ...valid, route: 'games' }).success).toBe(false)
    expect(
      guideSchema.safeParse({ ...valid, sources: [{ repo: 'other', path: 'a.ts' }] }).success,
    ).toBe(false)
    expect(guideSchema.safeParse({ ...valid, verifiedWith: 'latest' }).success).toBe(false)
  })

  it('rejects source paths that are absolute, climb out, or carry a URL', () => {
    ;[
      '/hooks/a.ts',
      '../a.ts',
      'hooks/../a.ts',
      './a.ts',
      'https://example.com/a.ts',
      'hooks//a.ts',
    ].forEach((path) => {
      expect(guideSchema.safeParse({ ...valid, sources: [{ repo: 'pet', path }] }).success).toBe(
        false,
      )
    })
  })

  it('rejects an empty title and a description over 200 characters', () => {
    expect(guideSchema.safeParse({ ...valid, title: '' }).success).toBe(false)
    expect(guideSchema.safeParse({ ...valid, description: 'x'.repeat(201) }).success).toBe(false)
  })
})

const guidesRoot = join(process.cwd(), 'src', 'content', 'guides')

const listMarkdown = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return listMarkdown(path)
    return entry.name.endsWith('.md') ? [path] : []
  })

const files = listMarkdown(guidesRoot)

const field = (source: string, name: string): string | undefined =>
  new RegExp(`^${name}: (?<value>.+)$`, 'mv').exec(source)?.groups?.value.trim()

const guides: GuideRef[] = files.map((path) => {
  const id = relative(guidesRoot, path).split(sep).join('/').replace(/\.md$/v, '')
  const location = parseGuideId(id)
  if (location === undefined) throw new Error(`Guide outside locale/route/slug: ${id}`)
  const source = readFileSync(path, 'utf8')
  return {
    ...location,
    id,
    order: Number(field(source, 'order')),
    draft: field(source, 'draft') === 'true',
    title: field(source, 'title') ?? '',
  }
})

describe('guide files', () => {
  it('exist', () => {
    expect(guides.length).toBeGreaterThan(0)
  })

  it('exist in every locale', () => {
    expect(missingTranslations(guides, locales)).toEqual([])
  })

  it('declare the route of the folder they live in', () => {
    files.forEach((path, index) => {
      expect(field(readFileSync(path, 'utf8'), 'route')).toBe(guides[index].route)
    })
  })

  it('keep the same order in every locale', () => {
    const orders = new Map<string, number>()
    guides.forEach((guide) => {
      const key = `${guide.route}/${guide.slug}`
      const known = orders.get(key)
      if (known === undefined) orders.set(key, guide.order)
      else expect(guide.order, key).toBe(known)
    })
  })
})
