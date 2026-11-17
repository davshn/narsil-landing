import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { scriptHash } from '../csp-hash'

describe('scriptHash', () => {
  it('returns the CSP sha256 source of the exact UTF-8 content', () => {
    const code = "console.info('ñ')"
    const digest = createHash('sha256').update(Buffer.from(code, 'utf8')).digest('base64')

    expect(scriptHash(code)).toBe(`sha256-${digest}`)
  })

  it('changes when a single whitespace character changes', () => {
    expect(scriptHash('a()')).not.toBe(scriptHash('a() '))
  })
})
