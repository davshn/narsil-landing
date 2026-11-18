// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import GuideDots from './GuideDots.astro'

const guides = [
  { number: 3, title: 'Xiaozhi in the belly', href: '/en/bot/xiaozhi-belly/' },
  { number: 9, title: 'The belly screen', href: '/en/bot/belly-ui/' },
]

describe('GuideDots', () => {
  it('links each guide by its number, with the full guide name as its label', async () => {
    const host = await render(GuideDots, {
      props: { guides, labelTemplate: 'Guide {number}: {title}' },
    })
    const links = [...host.querySelectorAll('ol[data-guide-dots] a.guide-dot')]

    expect(links.map((link) => link.textContent.trim())).toEqual(['3', '9'])
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/en/bot/xiaozhi-belly/',
      '/en/bot/belly-ui/',
    ])
    expect(links.map((link) => link.getAttribute('aria-label'))).toEqual([
      'Guide 3: Xiaozhi in the belly',
      'Guide 9: The belly screen',
    ])
    expect(links[1].getAttribute('title')).toBe('The belly screen')
  })

  it('renders an empty list when there are no guides', async () => {
    const host = await render(GuideDots, { props: { guides: [], labelTemplate: '{number}' } })

    expect(host.querySelectorAll('.guide-dot')).toHaveLength(0)
  })
})
