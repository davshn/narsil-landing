import { describe, expect, it } from 'vitest'

import { safeHref } from '../safe-href'

const js = (rest: string): string => ['javascript', rest].join(':')

describe('safeHref', () => {
  it.each([
    '/en/',
    '/en/pricing?plan=pro#faq',
    '#features',
    '?ref=hero',
    './docs',
    '../up',
    'pricing',
    'https://example.com/path',
    'HTTP://example.com',
    'mailto:hello@example.com',
    'tel:+15551234567',
  ])('keeps %j', (href) => {
    expect(safeHref(href)).toBe(href)
  })

  it.each([
    js('alert(1)'),
    ['JavaScript', 'alert(1)'].join(':'),
    ` ${js('alert(1)')}`,
    ['java', 'script:alert(1)'].join('\t'),
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    '//evil.example',
    '\\evil.example',
    '/\\evil.example',
  ])('drops %j', (href) => {
    expect(safeHref(href)).toBeUndefined()
  })

  it('returns undefined for undefined, empty, and blank values', () => {
    expect(safeHref(undefined)).toBeUndefined()
    expect(safeHref('')).toBeUndefined()
    expect(safeHref('   ')).toBeUndefined()
  })
})
