// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import Accordion from './Accordion.astro'

const items = [
  { label: 'First', content: 'One' },
  { label: 'Second', content: 'Two', open: true },
]

describe('Accordion', () => {
  it('renders one native <details> per item with label and content', async () => {
    const host = await render(Accordion, { props: { items } })
    const details = host.querySelectorAll('details.accordion-item')

    expect(details).toHaveLength(2)
    expect(details[0].querySelector('summary .accordion-label')?.textContent).toBe('First')
    expect(details[0].querySelector('.accordion-content')?.textContent).toContain('One')
  })

  it('opens only the items marked open', async () => {
    const host = await render(Accordion, { props: { items } })
    const details = host.querySelectorAll('details')

    expect(details[0].hasAttribute('open')).toBe(false)
    expect(details[1].hasAttribute('open')).toBe(true)
  })

  it('groups items with a shared name so only one opens at a time', async () => {
    const host = await render(Accordion, { props: { items } })
    const names = [...host.querySelectorAll('details')].map((d) => d.getAttribute('name'))

    expect(names[0]).toMatch(/^accordion-/v)
    expect(names[1]).toBe(names[0])
  })

  it('derives the same group name on every render of the same items', async () => {
    const first = await render(Accordion, { props: { items } })
    const second = await render(Accordion, { props: { items } })

    expect(first.querySelector('details')?.getAttribute('name')).toBe(
      second.querySelector('details')?.getAttribute('name'),
    )
  })

  it('uses a different group name for different items', async () => {
    const first = await render(Accordion, { props: { items } })
    const other = await render(Accordion, {
      props: { items: [{ label: 'Other', content: 'Different' }] },
    })

    expect(first.querySelector('details')?.getAttribute('name')).not.toBe(
      other.querySelector('details')?.getAttribute('name'),
    )
  })

  it('uses an explicit name for every item when provided', async () => {
    const host = await render(Accordion, { props: { items, name: 'pricing-faq' } })
    const names = [...host.querySelectorAll('details')].map((d) => d.getAttribute('name'))

    expect(new Set(names)).toEqual(new Set(['pricing-faq']))
  })

  it('omits the group name when multiple items may be open', async () => {
    const host = await render(Accordion, { props: { items, multiple: true } })
    const details = [...host.querySelectorAll('details')]

    expect(details.every((d) => !d.hasAttribute('name'))).toBe(true)
  })

  it('hides the chevron icon from assistive tech', async () => {
    const host = await render(Accordion, { props: { items } })
    expect(host.querySelector('svg.accordion-chevron')?.getAttribute('aria-hidden')).toBe('true')
  })
})
