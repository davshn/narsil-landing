import { describe, expect, it } from 'vitest'

import { buildAlternateUrl } from '../alternate-url'

const SITE = new URL('https://example.com')
const LOCALES = ['en', 'es'] as const

describe('buildAlternateUrl', () => {
  it('replaces the locale on the root path', () => {
    expect(buildAlternateUrl('/en/', 'es', SITE, LOCALES)).toBe('https://example.com/es/')
  })

  it('replaces the locale and keeps sub-paths', () => {
    expect(buildAlternateUrl('/en/pricing/', 'es', SITE, LOCALES)).toBe(
      'https://example.com/es/pricing/',
    )
  })

  it('prepends the locale when the path has no locale prefix', () => {
    expect(buildAlternateUrl('/', 'en', SITE, LOCALES)).toBe('https://example.com/en/')
  })

  it('handles paths without a trailing slash', () => {
    expect(buildAlternateUrl('/en', 'es', SITE, LOCALES)).toBe('https://example.com/es/')
  })

  it('preserves deep path segments', () => {
    expect(buildAlternateUrl('/es/features/automation/', 'en', SITE, LOCALES)).toBe(
      'https://example.com/en/features/automation/',
    )
  })

  it('always returns a URL with a trailing slash', () => {
    const result = buildAlternateUrl('/en/pricing', 'es', SITE, LOCALES)
    expect(result).toMatch(/\/$/v)
  })

  it('includes the site origin in the result', () => {
    const result = buildAlternateUrl('/en/', 'es', SITE, LOCALES)
    expect(result).toMatch(/^https:\/\/example\.com/v)
  })
})
