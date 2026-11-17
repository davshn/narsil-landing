import { describe, expect, it } from 'vitest'

import { defaultLocale, isLocale, locales, ogLocales } from '../index'

describe('locales', () => {
  it('contains the expected supported locales', () => {
    expect(locales).toContain('en')
    expect(locales).toContain('es')
  })
})

describe('defaultLocale', () => {
  it('is a supported locale', () => {
    expect(isLocale(defaultLocale)).toBe(true)
  })
})

describe('isLocale', () => {
  it('returns true for each supported locale', () => {
    locales.forEach((locale) => {
      expect(isLocale(locale)).toBe(true)
    })
  })

  it('returns false for unsupported values', () => {
    expect(isLocale('fr')).toBe(false)
    expect(isLocale('')).toBe(false)
    expect(isLocale('EN')).toBe(false)
    expect(isLocale('en-US')).toBe(false)
  })
})

describe('ogLocales', () => {
  it('maps every supported locale to an Open Graph language_TERRITORY code', () => {
    locales.forEach((locale) => {
      expect(ogLocales[locale]).toMatch(/^[a-z]{2}_[A-Z]{2}$/v)
    })
  })

  it('uses en_US and es_ES', () => {
    expect(ogLocales.en).toBe('en_US')
    expect(ogLocales.es).toBe('es_ES')
  })
})
