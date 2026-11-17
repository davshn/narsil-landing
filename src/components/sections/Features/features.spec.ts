// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import Features from './Features.astro'

const features = [
  { title: 'Fast', description: 'Static by default', icon: 'lucide:zap' },
  { title: 'Accessible' },
]

describe('Features', () => {
  it('renders one item per feature with an h3 title', async () => {
    const host = await render(Features, { props: { features } })
    const titles = [...host.querySelectorAll('.features-item h3')].map((h) => h.textContent)

    expect(titles).toEqual(['Fast', 'Accessible'])
  })

  it('renders description and decorative icon only when provided', async () => {
    const host = await render(Features, { props: { features } })
    const [first, second] = [...host.querySelectorAll('.features-item')]

    expect(first.querySelector('.features-item-description')?.textContent).toBe('Static by default')
    expect(first.querySelector('.features-icon svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(second.querySelector('.features-item-description')).toBeNull()
    expect(second.querySelector('.features-icon')).toBeNull()
  })

  it('renders an h2 title and subtitle header', async () => {
    const host = await render(Features, {
      props: { features, title: 'Why us', subtitle: 'Everything you need' },
    })

    expect(host.querySelector('h2.features-title')?.textContent).toBe('Why us')
    expect(host.querySelector('.features-subtitle')?.textContent).toBe('Everything you need')
  })

  it('omits the header without title or subtitle', async () => {
    const host = await render(Features, { props: { features } })
    expect(host.querySelector('.features-header')).toBeNull()
  })

  it('uses 3 columns by default and accepts 2 or 4', async () => {
    const defaults = await render(Features, { props: { features } })
    const four = await render(Features, { props: { features, columns: 4 } })

    expect(defaults.querySelector('section')?.classList.contains('features-cols-3')).toBe(true)
    expect(four.querySelector('section')?.classList.contains('features-cols-4')).toBe(true)
  })
})
