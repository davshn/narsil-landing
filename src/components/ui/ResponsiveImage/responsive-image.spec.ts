// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import ResponsiveImage from './ResponsiveImage.astro'

const base = { src: '/photo.jpg', alt: 'Team photo', width: 800, height: 600 }

describe('ResponsiveImage', () => {
  it('renders a <picture> with an <img> that keeps alt text and dimensions', async () => {
    const host = await render(ResponsiveImage, { props: base })
    const img = host.querySelector('picture img')

    expect(img?.getAttribute('alt')).toBe('Team photo')
    expect(img?.getAttribute('width')).toBe('800')
    expect(img?.getAttribute('height')).toBe('600')
  })

  it('lazy loads with async decoding by default', async () => {
    const host = await render(ResponsiveImage, { props: base })
    const img = host.querySelector('img')

    expect(img?.getAttribute('loading')).toBe('lazy')
    expect(img?.getAttribute('decoding')).toBe('async')
  })

  it('loads eagerly with sync decoding and fetch priority for above-the-fold images', async () => {
    const host = await render(ResponsiveImage, {
      props: { ...base, loading: 'eager', fetchpriority: 'high' },
    })
    const img = host.querySelector('img')

    expect(img?.getAttribute('loading')).toBe('eager')
    expect(img?.getAttribute('decoding')).toBe('sync')
    expect(img?.getAttribute('fetchpriority')).toBe('high')
  })

  it('applies classes to the image and the picture element', async () => {
    const host = await render(ResponsiveImage, {
      props: { ...base, class: 'rounded', pictureClass: 'frame' },
    })

    expect(host.querySelector('picture')?.classList.contains('frame')).toBe(true)
    expect(host.querySelector('img')?.classList.contains('rounded')).toBe(true)
  })
})
