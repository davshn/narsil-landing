import { describe, expect, it } from 'vitest'

import { MISSING_SITE_URL_WARNING, missingSiteUrlWarning } from '../site-url'

describe('missingSiteUrlWarning', () => {
  it('warns when the site URL is undefined', () => {
    expect(missingSiteUrlWarning(undefined)).toBe(MISSING_SITE_URL_WARNING)
  })

  it('warns when the site URL is empty or blank', () => {
    expect(missingSiteUrlWarning('')).toBe(MISSING_SITE_URL_WARNING)
    expect(missingSiteUrlWarning('   ')).toBe(MISSING_SITE_URL_WARNING)
  })

  it('does not warn when the site URL is set', () => {
    expect(missingSiteUrlWarning('https://example.com')).toBeUndefined()
  })
})
