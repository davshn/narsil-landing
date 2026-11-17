import { describe, expect, it } from 'vitest'

import { defaultLocale, locales } from '../index'
import { getLocaleFromUrl, useTranslations } from '../utils'

const keyPaths = (value: unknown, prefix = ''): string[] => {
  if (typeof value !== 'object' || value === null) return [prefix]
  return Object.entries(value).flatMap(([key, child]) =>
    keyPaths(child, prefix === '' ? key : `${prefix}.${key}`),
  )
}

const leafValues = (value: unknown): unknown[] => {
  if (typeof value !== 'object' || value === null) return [value]
  return Object.values(value).flatMap((child) => leafValues(child))
}

describe('useTranslations', () => {
  it.each(locales)('returns translations for "%s"', (locale) => {
    const t = useTranslations(locale)
    expect(t.meta.title).toBeDefined()
    expect(t.home.headline).toBeDefined()
  })

  it('has the same keys in every locale', () => {
    const [first, ...rest] = locales.map((locale) => keyPaths(useTranslations(locale)).sort())

    rest.forEach((paths) => {
      expect(paths).toEqual(first)
    })
  })

  it.each(locales)('has no empty strings in %s', (locale) => {
    leafValues(useTranslations(locale)).forEach((value) => {
      expect(typeof value).toBe('string')
      expect(value).not.toBe('')
    })
  })

  it('has a different CTA in every locale', () => {
    const ctas = locales.map((locale) => useTranslations(locale).home.cta)
    expect(new Set(ctas).size).toBe(locales.length)
  })

  it('keeps the brand name in every locale', () => {
    locales.forEach((locale) => {
      expect(useTranslations(locale).meta.siteName).toBe('Narsil Workshop')
    })
  })

  it.each(locales)('keeps the Anthropic trademark notice in %s', (locale) => {
    const {
      footer: { trademark },
    } = useTranslations(locale)
    expect(trademark).toContain('Claude Code')
    expect(trademark).toContain('Anthropic, PBC')
  })

  it.each(locales)('keeps the route icons in %s', (locale) => {
    expect(useTranslations(locale).home.routes.map((route) => route.icon)).toEqual([
      'lucide:sparkles',
      'lucide:list-checks',
      'lucide:cpu',
    ])
  })
})

describe('getLocaleFromUrl', () => {
  it.each(locales)('extracts "%s" from its path prefix', (locale) => {
    expect(getLocaleFromUrl(new URL(`http://localhost/${locale}/`))).toBe(locale)
  })

  it('extracts locale from nested paths', () => {
    expect(getLocaleFromUrl(new URL('http://localhost/pt/support/'))).toBe('pt')
  })

  it('returns defaultLocale for root path', () => {
    expect(getLocaleFromUrl(new URL('http://localhost/'))).toBe(defaultLocale)
  })

  it('returns defaultLocale for unknown locale', () => {
    expect(getLocaleFromUrl(new URL('http://localhost/de/'))).toBe(defaultLocale)
  })
})
