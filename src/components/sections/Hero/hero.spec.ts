// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import Hero from './Hero.astro'

describe('Hero', () => {
  it('renders a centered section with an h1 headline by default', async () => {
    const host = await render(Hero, { props: { headline: 'Ship faster' } })
    const section = host.querySelector('section.hero')

    expect(section?.classList.contains('hero-center')).toBe(true)
    expect(section?.querySelector('h1.hero-headline')?.textContent).toBe('Ship faster')
  })

  it('uses the requested heading level so pages keep a single h1', async () => {
    const host = await render(Hero, { props: { headline: 'H', headingLevel: 'h2' } })

    expect(host.querySelector('h1')).toBeNull()
    expect(host.querySelector('h2.hero-headline')?.textContent).toBe('H')
  })

  it('renders the media slot beside the content only when it is filled', async () => {
    const bare = await render(Hero, { props: { headline: 'H' } })
    const withMedia = await render(Hero, {
      props: { headline: 'H', layout: 'split' },
      slots: { media: '<img src="/narsil.webp" alt="Narsil">' },
    })

    expect(bare.querySelector('.hero-media')).toBeNull()
    expect(withMedia.querySelector('.hero-media img')?.getAttribute('alt')).toBe('Narsil')
    expect(withMedia.querySelector('.hero-content .hero-media')).toBeNull()
  })

  it('renders optional badge and subheadline', async () => {
    const host = await render(Hero, {
      props: { headline: 'H', badge: 'New', subheadline: 'Built with Astro' },
    })

    expect(host.querySelector('.hero-badge')?.textContent).toContain('New')
    expect(host.querySelector('.hero-subheadline')?.textContent).toBe('Built with Astro')
  })

  it('renders large actions, primary by default', async () => {
    const host = await render(Hero, {
      props: { headline: 'H', actions: [{ label: 'Start', href: '/start' }] },
    })
    const action = host.querySelector('.hero-actions a')

    expect(action?.getAttribute('href')).toBe('/start')
    expect(action?.classList.contains('btn-primary')).toBe(true)
    expect(action?.classList.contains('btn-lg')).toBe(true)
  })

  it('loads the hero image eagerly with alt text', async () => {
    const host = await render(Hero, {
      props: { headline: 'H', layout: 'split', image: { src: '/hero.png', alt: 'Dashboard' } },
    })
    const img = host.querySelector('.hero-image img')

    expect(host.querySelector('section')?.classList.contains('hero-split')).toBe(true)
    expect(img?.getAttribute('alt')).toBe('Dashboard')
    expect(img?.getAttribute('loading')).toBe('eager')
  })

  it('omits optional parts when not provided', async () => {
    const host = await render(Hero, { props: { headline: 'H' } })

    expect(host.querySelector('.hero-badge')).toBeNull()
    expect(host.querySelector('.hero-subheadline')).toBeNull()
    expect(host.querySelector('.hero-actions')).toBeNull()
    expect(host.querySelector('.hero-image')).toBeNull()
  })
})
