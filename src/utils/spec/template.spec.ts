// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { fillTemplate } from '../template'

describe('fillTemplate', () => {
  it('replaces every named placeholder', () => {
    expect(fillTemplate('Guide {current} of {total}', { current: 2, total: 5 })).toBe(
      'Guide 2 of 5',
    )
  })

  it('leaves unknown placeholders untouched', () => {
    expect(fillTemplate('{a} and {b}', { a: 'x' })).toBe('x and {b}')
  })

  it('does not read inherited properties', () => {
    expect(fillTemplate('{toString}', {})).toBe('{toString}')
  })
})
