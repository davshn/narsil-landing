import { describe, expect, it } from 'vitest'

import { isHttpsUrl } from '../https-url'

const scriptUrl = ['javascript', 'alert(1)'].join(':')

describe('isHttpsUrl', () => {
  it('accepts absolute https URLs', () => {
    expect(isHttpsUrl('https://analytics.example.com/script.js')).toBe(true)
    expect(isHttpsUrl('HTTPS://eu.posthog.com')).toBe(true)
  })

  it.each([
    'http://analytics.example.com/script.js',
    '//analytics.example.com/script.js',
    '/script.js',
    scriptUrl,
    'data:text/javascript,alert(1)',
    '',
  ])('rejects %j', (value) => {
    expect(isHttpsUrl(value)).toBe(false)
  })
})
