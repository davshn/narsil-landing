// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import CTA from './CTA.astro'

describe('CTA', () => {
  it('renders a centered default section with an h2 headline', async () => {
    const host = await render(CTA, { props: { headline: 'Ready to start?' } })
    const section = host.querySelector('section.cta')

    expect(section?.classList.contains('cta-default')).toBe(true)
    expect(section?.classList.contains('cta-center')).toBe(true)
    expect(section?.querySelector('h2.cta-headline')?.textContent).toBe('Ready to start?')
  })

  it('renders the description only when provided', async () => {
    const withText = await render(CTA, { props: { headline: 'H', description: 'Join today' } })
    const without = await render(CTA, { props: { headline: 'H' } })

    expect(withText.querySelector('.cta-description')?.textContent).toBe('Join today')
    expect(without.querySelector('.cta-description')).toBeNull()
  })

  it('renders large action buttons, primary by default', async () => {
    const host = await render(CTA, {
      props: {
        headline: 'H',
        actions: [
          { label: 'Start', href: '/start' },
          { label: 'Docs', variant: 'outline' },
        ],
      },
    })
    const [first, second] = [...host.querySelectorAll('.cta-actions > *')]

    expect(first.tagName).toBe('A')
    expect(first.getAttribute('href')).toBe('/start')
    expect(first.classList.contains('btn-primary')).toBe(true)
    expect(first.classList.contains('btn-lg')).toBe(true)
    expect(second.classList.contains('btn-outline')).toBe(true)
  })

  it('omits the actions row without actions', async () => {
    const host = await render(CTA, { props: { headline: 'H' } })
    expect(host.querySelector('.cta-actions')).toBeNull()
  })

  it('applies variant and alignment', async () => {
    const host = await render(CTA, { props: { headline: 'H', variant: 'card', align: 'left' } })
    const section = host.querySelector('section')

    expect(section?.classList.contains('cta-card')).toBe(true)
    expect(section?.classList.contains('cta-left')).toBe(true)
  })
})
