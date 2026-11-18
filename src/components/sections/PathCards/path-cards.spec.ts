// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import PathCards from './PathCards.astro'

const paths = [
  {
    title: 'Your own status pet',
    description: 'States above the prompt.',
    icon: 'lucide:sparkles',
    href: '/en/mods/pet/',
    meta: '17 guides',
  },
  {
    title: 'A Narsil desk bot',
    description: 'A body for Narsil.',
    icon: 'lucide:cpu',
    href: '/en/bot/',
  },
]

describe('PathCards', () => {
  it('links one card per path in order, numbered from 01', async () => {
    const host = await render(PathCards, { props: { id: 'routes', title: 'Paths', paths } })
    const cards = [...host.querySelectorAll('.path-card')]

    expect(host.querySelector('section')?.getAttribute('id')).toBe('routes')
    expect(
      cards.map((card) => card.querySelector('.path-card-link')?.getAttribute('href')),
    ).toEqual(['/en/mods/pet/', '/en/bot/'])
    expect(cards.map((card) => card.querySelector('.path-card-index')?.textContent.trim())).toEqual(
      ['01', '02'],
    )
    expect(cards[0].querySelector('.path-card-index')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('shows the description, a decorative icon, and the guide count only when there is one', async () => {
    const host = await render(PathCards, { props: { title: 'Paths', paths } })
    const [pet, bot] = [...host.querySelectorAll('.path-card')]

    expect(pet.querySelector('.path-card-description')?.textContent).toBe(
      'States above the prompt.',
    )
    expect(pet.querySelector('.path-card-icon svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(pet.querySelector('.path-card-meta')?.textContent).toBe('17 guides')
    expect(bot.querySelector('.path-card-meta')).toBeNull()
  })

  it('names the section by its heading and renders the subtitle only when provided', async () => {
    const bare = await render(PathCards, { props: { title: 'Paths', paths } })
    const full = await render(PathCards, { props: { title: 'Paths', subtitle: 'Pick one', paths } })

    expect(bare.querySelector('section')?.getAttribute('aria-labelledby')).toBe('path-cards-title')
    expect(bare.querySelector('#path-cards-title')?.textContent).toBe('Paths')
    expect(bare.querySelector('.section-description')).toBeNull()
    expect(full.querySelector('.section-description')?.textContent).toBe('Pick one')
  })
})
