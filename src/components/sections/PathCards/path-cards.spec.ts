// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import PathCards from './PathCards.astro'

const paths = [
  {
    title: 'Your own status pet',
    description: 'States above the prompt.',
    pose: 'hola',
    href: '/en/mods/pet/',
    meta: '17 guides',
    repo: { href: 'https://github.com/example/pet', label: 'See pet on GitHub' },
  },
  {
    title: 'A Narsil desk bot',
    description: 'A body for Narsil.',
    pose: 'terminado',
    href: '/en/bot/',
  },
  {
    title: 'Narsil for Android',
    description: 'On your phone.',
    pose: 'necesita',
    href: '/en/android/',
    meta: '5 guides',
    detour: 'Experimental',
  },
]

const start = {
  title: 'Mod fundamentals',
  description: 'The base of every prompt.',
  href: '/en/mods/',
  meta: '5 guides',
}

describe('PathCards', () => {
  it('links one stop per path in order, numbered after the start, with the detour unnumbered', async () => {
    const host = await render(PathCards, { props: { id: 'routes', title: 'Paths', start, paths } })
    const cards = [...host.querySelectorAll('.path-card')]

    expect(host.querySelector('section')?.getAttribute('id')).toBe('routes')
    expect(
      cards.map((card) => card.querySelector('.path-card-link')?.getAttribute('href')),
    ).toEqual(['/en/mods/pet/', '/en/bot/', '/en/android/'])
    expect(
      cards.map((card) => card.querySelector('.path-card-index')?.textContent.trim() ?? null),
    ).toEqual(['2', '3', null])
    expect(cards[0].querySelector('.path-card-index')?.getAttribute('aria-hidden')).toBe('true')
    expect(cards[2].classList.contains('path-card-detour')).toBe(true)
    expect(cards[2].querySelector('.path-card-badge')?.textContent.trim()).toBe('Experimental')
  })

  it('opens the journey with the start as step 1, joined to the stops by a decorative line', async () => {
    const host = await render(PathCards, { props: { title: 'Paths', start, paths } })
    const link = host.querySelector('.path-start')

    expect(link?.getAttribute('href')).toBe('/en/mods/')
    expect(link?.querySelector('.path-start-step')?.textContent.trim()).toBe('1')
    expect(link?.querySelector('.path-start-title')?.textContent).toBe('Mod fundamentals')
    expect(link?.querySelector('.path-start-meta')?.textContent).toBe('5 guides')
    expect(host.querySelector('.path-connector')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('numbers the stops from 1 and draws no start or line without a start', async () => {
    const host = await render(PathCards, { props: { title: 'Paths', paths: paths.slice(0, 2) } })

    expect(host.querySelector('.path-start')).toBeNull()
    expect(host.querySelector('.path-connector')).toBeNull()
    expect(
      [...host.querySelectorAll('.path-card-index')].map((index) => index.textContent.trim()),
    ).toEqual(['1', '2'])
  })

  it('shows the description, a decorative pose, and the guide count only when there is one', async () => {
    const host = await render(PathCards, { props: { title: 'Paths', paths } })
    const [pet, bot] = [...host.querySelectorAll('.path-card')]

    expect(pet.querySelector('.path-card-description')?.textContent).toBe(
      'States above the prompt.',
    )
    expect(pet.querySelector('.path-card-pose img')?.getAttribute('alt')).toBe('')
    expect(pet.querySelector('.path-card-pose img')?.getAttribute('src')).toBe(
      '/narsil/hola-claro.webp',
    )
    expect(pet.querySelector('.path-card-meta')?.textContent).toBe('17 guides')
    expect(bot.querySelector('.path-card-meta')).toBeNull()
  })

  it('links the repository in a new tab only on cards that have one', async () => {
    const host = await render(PathCards, { props: { title: 'Paths', paths } })
    const [pet, bot, android] = [...host.querySelectorAll('.path-card')]
    const repo = pet.querySelector('.path-card-repo')

    expect(repo?.getAttribute('href')).toBe('https://github.com/example/pet')
    expect(repo?.getAttribute('target')).toBe('_blank')
    expect(repo?.getAttribute('rel')).toBe('noopener')
    expect(repo?.textContent.trim()).toBe('See pet on GitHub')
    expect(bot.querySelector('.path-card-repo')).toBeNull()
    expect(android.querySelector('.path-card-repo')).toBeNull()
  })

  it('names the section by its heading and renders the subtitle and Narsil guide only when provided', async () => {
    const bare = await render(PathCards, { props: { title: 'Paths', paths } })
    const full = await render(PathCards, {
      props: { title: 'Paths', subtitle: 'Pick one', guide: 'Start here.', paths },
    })

    expect(bare.querySelector('section')?.getAttribute('aria-labelledby')).toBe('path-cards-title')
    expect(bare.querySelector('#path-cards-title')?.textContent).toBe('Paths')
    expect(bare.querySelector('.section-description')).toBeNull()
    expect(bare.querySelector('.path-cards-guide')).toBeNull()
    expect(full.querySelector('.section-description')?.textContent).toBe('Pick one')
    expect(full.querySelector('.path-cards-guide .narsil-bubble')?.textContent).toBe('Start here.')
  })
})
