import { describe, expect, it } from 'vitest'

import { serializeForInlineScript } from '../inline-json'

describe('serializeForInlineScript', () => {
  it('serializes plain values exactly like JSON.stringify', () => {
    const value = { name: 'Acme', tags: ['a', 'b'], count: 2 }
    expect(serializeForInlineScript(value)).toBe(JSON.stringify(value))
  })

  it('escapes a closing script tag so it cannot end the script element', () => {
    const output = serializeForInlineScript({ text: '</script><img src=x onerror=alert(1)>' })
    expect(output).not.toContain('</script')
    expect(output).not.toContain('<img')
    expect(output).toContain(String.raw`\u003c/script\u003e`)
  })

  it('escapes HTML comment openers and ampersands', () => {
    const output = serializeForInlineScript('<!-- a & b -->')
    expect(output).toBe(String.raw`"\u003c!-- a \u0026 b --\u003e"`)
  })

  it('escapes line and paragraph separators', () => {
    const output = serializeForInlineScript('a\u2028b\u2029c')
    expect(output).toBe(String.raw`"a\u2028b\u2029c"`)
  })

  it('round-trips through JSON.parse to the original value', () => {
    const value = { answer: '</script> & <!-- \u2028 -->', list: ['<b>'] }
    expect(JSON.parse(serializeForInlineScript(value))).toEqual(value)
  })
})
