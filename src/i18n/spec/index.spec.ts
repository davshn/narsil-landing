import { describe, expect, it } from 'vitest'

import { defaultLocale, isLocale, languageTags, localeNames, locales, ogLocales } from '../index'

describe('locales', () => {
  it('contains English, Spanish, Italian, French, and Portuguese', () => {
    expect([...locales]).toEqual(['en', 'es', 'it', 'fr', 'pt'])
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
    expect(isLocale('de')).toBe(false)
    expect(isLocale('pt-BR')).toBe(false)
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

  it('uses en_US, es_ES, it_IT, fr_FR, and pt_BR', () => {
    expect(ogLocales.en).toBe('en_US')
    expect(ogLocales.es).toBe('es_ES')
    expect(ogLocales.it).toBe('it_IT')
    expect(ogLocales.fr).toBe('fr_FR')
    expect(ogLocales.pt).toBe('pt_BR')
  })
})

describe('languageTags', () => {
  it('maps Portuguese to pt-BR and every other locale to its own code', () => {
    expect(languageTags.pt).toBe('pt-BR')
    locales
      .filter((locale) => locale !== 'pt')
      .forEach((locale) => {
        expect(languageTags[locale]).toBe(locale)
      })
  })
})

describe('localeNames', () => {
  it('names every locale in its own language', () => {
    expect(locales.map((locale) => localeNames[locale])).toEqual([
      'English',
      'Español',
      'Italiano',
      'Français',
      'Português (Brasil)',
    ])
  })
})
