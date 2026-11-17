import { describe, expect, it } from 'vitest'

import { accordionGroupName } from '../accordion-name'

const items = [
  { label: 'Is it free?', content: 'Yes.' },
  { label: 'How to deploy?', content: 'Build and host dist/.' },
]

describe('accordionGroupName', () => {
  it('returns the same name for the same items', () => {
    expect(accordionGroupName(items)).toBe(accordionGroupName([...items]))
    expect(accordionGroupName(items)).toMatch(/^accordion-[0-9a-f]{8}$/v)
  })

  it('returns a different name when any label or content changes', () => {
    const changed = [items[0], { label: 'How to deploy?', content: 'Push to main.' }]
    expect(accordionGroupName(changed)).not.toBe(accordionGroupName(items))
  })

  it('does not confuse label and content boundaries', () => {
    expect(accordionGroupName([{ label: 'ab', content: 'c' }])).not.toBe(
      accordionGroupName([{ label: 'a', content: 'bc' }]),
    )
  })

  it('prefers an explicit non-blank name', () => {
    expect(accordionGroupName(items, 'pricing-faq')).toBe('pricing-faq')
    expect(accordionGroupName(items, '  ')).toBe(accordionGroupName(items))
  })
})
