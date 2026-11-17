import { describe, expect, it } from 'vitest'

import { defaultLocale } from '../index'
import { getLocaleFromUrl, useTranslations } from '../utils'

describe('useTranslations', () => {
  it('returns translations for "en"', () => {
    const t = useTranslations('en')
    expect(t.meta.title).toBeDefined()
    expect(t.hero.headline).toBeDefined()
  })

  it('returns translations for "es"', () => {
    const t = useTranslations('es')
    expect(t.meta.title).toBeDefined()
    expect(t.hero.headline).toBeDefined()
  })

  it('en and es share the same top-level structure', () => {
    const en = useTranslations('en')
    const es = useTranslations('es')
    expect(Object.keys(en)).toEqual(Object.keys(es))
  })

  it('en and es have different CTA text', () => {
    const en = useTranslations('en')
    const es = useTranslations('es')
    expect(en.hero.cta).not.toBe(es.hero.cta)
  })
})

describe('getLocaleFromUrl', () => {
  it('extracts "en" from /en/ path', () => {
    expect(getLocaleFromUrl(new URL('http://localhost/en/'))).toBe('en')
  })

  it('extracts "es" from /es/ path', () => {
    expect(getLocaleFromUrl(new URL('http://localhost/es/'))).toBe('es')
  })

  it('extracts locale from nested paths', () => {
    expect(getLocaleFromUrl(new URL('http://localhost/es/pricing'))).toBe('es')
  })

  it('returns defaultLocale for root path', () => {
    expect(getLocaleFromUrl(new URL('http://localhost/'))).toBe(defaultLocale)
  })

  it('returns defaultLocale for unknown locale', () => {
    expect(getLocaleFromUrl(new URL('http://localhost/fr/'))).toBe(defaultLocale)
  })
})
