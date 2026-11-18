// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import Showcase from './Showcase.astro'

const items = [
  {
    title: 'The floating window',
    text: 'Every conversation at once.',
    alt: 'The floating window',
    frame: 'window',
    light: '/window-light.png',
    dark: '/window-dark.png',
    width: 300,
    height: 620,
  },
  {
    title: 'On your phone',
    text: 'Alerts through ntfy.',
    alt: 'The phone app',
    frame: 'phone',
    light: '/phone-light.png',
    dark: '/phone-dark.png',
    width: 390,
    height: 844,
  },
]

describe('Showcase', () => {
  it('renders one figure per item with its caption and frame', async () => {
    const host = await render(Showcase, { props: { title: 'How it looks', items } })
    const figures = [...host.querySelectorAll('figure.showcase-item')]

    expect(
      figures.map((figure) => figure.querySelector('.showcase-caption-title')?.textContent),
    ).toEqual(['The floating window', 'On your phone'])
    expect(
      figures[1].querySelector('.showcase-frame')?.classList.contains('showcase-frame-phone'),
    ).toBe(true)
  })

  it('shows the light capture in the light theme and the dark one in the dark theme', async () => {
    const host = await render(Showcase, { props: { title: 'How it looks', items } })
    const pictures = [...host.querySelectorAll('figure')[0].querySelectorAll('picture')]

    expect(pictures.map((picture) => picture.getAttribute('class'))).toEqual([
      'theme-light-only',
      'theme-dark-only',
    ])
    expect(pictures[0].querySelector('img')?.getAttribute('src')).toContain('window-light')
    expect(pictures[1].querySelector('img')?.getAttribute('src')).toContain('window-dark')
    expect(
      pictures.every(
        (picture) => picture.querySelector('img')?.getAttribute('alt') === 'The floating window',
      ),
    ).toBe(true)
  })

  it('lays a detail over the framed capture, each with its own alt text and size', async () => {
    const detail = {
      light: '/band.png',
      dark: '/band.png',
      alt: 'The band',
      width: 360,
      height: 120,
    }
    const host = await render(Showcase, {
      props: { title: 'How it looks', items: [{ ...items[1], detail }] },
    })
    const frame = host.querySelector('.showcase-frame-phone img')
    const band = host.querySelector('.showcase-detail img')

    expect(
      host.querySelector('.showcase-shots')?.classList.contains('showcase-shots-detailed'),
    ).toBe(true)
    expect(frame?.getAttribute('alt')).toBe('The phone app')
    expect(band?.getAttribute('alt')).toBe('The band')
    expect(band?.getAttribute('height')).toBe('120')
    expect(host.querySelector('.showcase-detail')?.classList.contains('showcase-frame')).toBe(false)
  })

  it('gives the light capture its own height when lightHeight is set', async () => {
    const detail = {
      light: '/band-light.png',
      dark: '/band-dark.png',
      alt: 'The band',
      width: 360,
      height: 120,
      lightHeight: 131,
    }
    const host = await render(Showcase, {
      props: { title: 'How it looks', items: [{ ...items[1], detail }] },
    })

    expect(
      host.querySelector('.showcase-detail .theme-light-only img')?.getAttribute('height'),
    ).toBe('131')
    expect(
      host.querySelector('.showcase-detail .theme-dark-only img')?.getAttribute('height'),
    ).toBe('120')
    expect(
      host.querySelector('.showcase-frame-phone .theme-light-only img')?.getAttribute('height'),
    ).toBe('844')
  })

  it('renders no detail when the item has none', async () => {
    const host = await render(Showcase, { props: { title: 'How it looks', items } })

    expect(host.querySelector('.showcase-shots-detailed')).toBeNull()
    expect(host.querySelector('.showcase-detail')).toBeNull()
  })

  it('renders the subtitle and the note only when provided', async () => {
    const bare = await render(Showcase, { props: { title: 'How it looks', items } })
    const full = await render(Showcase, {
      props: { title: 'How it looks', subtitle: 'Everywhere', note: 'Example data', items },
    })

    expect(bare.querySelector('.section-description')).toBeNull()
    expect(bare.querySelector('.showcase-note')).toBeNull()
    expect(full.querySelector('.section-description')?.textContent).toBe('Everywhere')
    expect(full.querySelector('.showcase-note')?.textContent).toBe('Example data')
  })
})
