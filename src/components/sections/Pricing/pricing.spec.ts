// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import Pricing from './Pricing.astro'

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'mo',
    features: [{ label: '1 project' }, { label: 'Analytics', included: false }],
    cta: 'Get started',
    ctaHref: '/signup',
  },
  {
    name: 'Pro',
    description: 'For teams',
    price: '$29',
    features: [{ label: 'Unlimited projects' }],
    cta: 'Start trial',
    highlighted: true,
    badge: 'Popular',
  },
]

describe('Pricing', () => {
  it('renders one card per plan with name and price', async () => {
    const host = await render(Pricing, { props: { plans } })
    const cards = host.querySelectorAll('.pricing-card')

    expect(cards).toHaveLength(2)
    expect(cards[0].querySelector('.pricing-name')?.textContent).toBe('Free')
    expect(cards[0].querySelector('.pricing-amount')?.textContent).toBe('$0')
    expect(cards[0].querySelector('.pricing-period')?.textContent).toBe('/mo')
    expect(cards[1].querySelector('.pricing-period')).toBeNull()
  })

  it('marks excluded features and shows check or x icons', async () => {
    const host = await render(Pricing, { props: { plans } })
    const [included, excluded] = [
      ...host.querySelectorAll('.pricing-card')[0].querySelectorAll('li'),
    ]

    expect(included.classList.contains('pricing-feature-disabled')).toBe(false)
    expect(excluded.classList.contains('pricing-feature-disabled')).toBe(true)
    expect(excluded.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('highlights a plan with its badge and a primary CTA', async () => {
    const host = await render(Pricing, { props: { plans } })
    const [, pro] = host.querySelectorAll('.pricing-card')

    expect(pro.classList.contains('pricing-card-highlighted')).toBe(true)
    expect(pro.querySelector('.pricing-badge')?.textContent).toBe('Popular')
    expect(pro.querySelector('.pricing-cta button')?.classList.contains('btn-primary')).toBe(true)
  })

  it('uses an outline CTA link for regular plans', async () => {
    const host = await render(Pricing, { props: { plans } })
    const cta = host.querySelectorAll('.pricing-card')[0].querySelector('.pricing-cta a')

    expect(cta?.getAttribute('href')).toBe('/signup')
    expect(cta?.classList.contains('btn-outline')).toBe(true)
    expect(cta?.textContent).toContain('Get started')
  })

  it('lets a plan override the CTA variant', async () => {
    const [free] = plans
    const host = await render(Pricing, { props: { plans: [{ ...free, ctaVariant: 'secondary' }] } })

    expect(host.querySelector('.pricing-cta a')?.classList.contains('btn-secondary')).toBe(true)
  })
})
