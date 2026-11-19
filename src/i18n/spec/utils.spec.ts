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

  it.each(locales)('names the three licenses in %s', (locale) => {
    const {
      footer: { license },
    } = useTranslations(locale)
    expect(license).toContain('MIT')
    expect(license).toContain('CC BY-SA 4.0')
    expect(license).toContain('GPL-3.0-or-later')
  })

  it.each(locales)(
    'describes the bot as Narsil with a body, not a bare ESP32-S3 bot, in %s',
    (locale) => {
      const {
        home: { routes },
      } = useTranslations(locale)
      expect(routes[2].description).toContain('ESP32-P4')
      expect(routes[2].description).toContain('ESP32-S3')
      expect(routes[2].description).toContain('Xiaozhi')
      expect(routes[2].description).toContain('Claude')
    },
  )

  it.each(locales)('lets Narsil introduce itself and show a working file in %s', (locale) => {
    const {
      home: { guide },
    } = useTranslations(locale)
    expect(guide.hello).toContain('Narsil')
    expect(guide.statusDetail).toContain('src/hooks.ts')
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
