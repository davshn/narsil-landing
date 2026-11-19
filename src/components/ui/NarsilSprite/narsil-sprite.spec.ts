// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import NarsilSprite from './NarsilSprite.astro'

describe('NarsilSprite', () => {
  it('renders a light and a dark picture, each shown only in its theme', async () => {
    const host = await render(NarsilSprite, { props: { pose: 'hola', alt: 'Narsil waving' } })
    const pictures = [...host.querySelectorAll('picture')]

    expect(pictures.map((picture) => picture.getAttribute('class'))).toEqual([
      'theme-light-only',
      'theme-dark-only',
    ])
    expect(pictures.map((picture) => picture.querySelector('img')?.getAttribute('src'))).toEqual([
      '/narsil/hola-claro.webp',
      '/narsil/hola-oscuro.webp',
    ])
  })

  it('swaps the animation for the still drawing when motion is reduced', async () => {
    const host = await render(NarsilSprite, { props: { pose: 'error', alt: '' } })
    const source = host.querySelector('picture source')

    expect(source?.getAttribute('media')).toBe('(prefers-reduced-motion: reduce)')
    expect(source?.getAttribute('srcset')).toBe('/narsil/error-claro.png')
  })

  it('keeps the alt text, lazy loads, and uses the medium size by default', async () => {
    const host = await render(NarsilSprite, { props: { pose: 'hola', alt: 'Narsil waving' } })
    const img = host.querySelector('img')

    expect(img?.getAttribute('alt')).toBe('Narsil waving')
    expect(img?.getAttribute('loading')).toBe('lazy')
    expect(img?.getAttribute('width')).toBe('90')
    expect(host.querySelector('.narsil-sprite')?.classList.contains('narsil-sprite-framed')).toBe(
      false,
    )
  })

  it('renders the large size inside a frame when asked', async () => {
    const host = await render(NarsilSprite, {
      props: { pose: 'hola', alt: '', size: 'lg', framed: true, loading: 'eager' },
    })
    const sprite = host.querySelector('.narsil-sprite')

    expect(sprite?.classList.contains('narsil-sprite-lg')).toBe(true)
    expect(sprite?.classList.contains('narsil-sprite-framed')).toBe(true)
    expect(host.querySelector('img')?.getAttribute('height')).toBe('200')
    expect(host.querySelector('img')?.getAttribute('loading')).toBe('eager')
  })

  it('sizes the small and extra large sprites by their own dimensions', async () => {
    const small = await render(NarsilSprite, { props: { pose: 'hola', alt: '', size: 'sm' } })
    const large = await render(NarsilSprite, { props: { pose: 'hola', alt: '', size: 'xl' } })

    expect(small.querySelector('.narsil-sprite')?.classList.contains('narsil-sprite-sm')).toBe(true)
    expect(small.querySelector('img')?.getAttribute('width')).toBe('48')
    expect(large.querySelector('.narsil-sprite')?.classList.contains('narsil-sprite-xl')).toBe(true)
    expect(large.querySelector('img')?.getAttribute('height')).toBe('256')
  })
})
