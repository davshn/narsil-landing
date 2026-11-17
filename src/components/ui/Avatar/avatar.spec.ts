// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import Avatar from './Avatar.astro'

describe('Avatar', () => {
  it('renders the image with the name as alt text by default', async () => {
    const host = await render(Avatar, { props: { src: '/me.png', name: 'Ada Lovelace' } })
    const img = host.querySelector('img.avatar-img')

    expect(img?.getAttribute('src')).toBe('/me.png')
    expect(img?.getAttribute('alt')).toBe('Ada Lovelace')
    expect(img?.getAttribute('loading')).toBe('lazy')
  })

  it('prefers an explicit alt over the name', async () => {
    const host = await render(Avatar, { props: { src: '/me.png', name: 'Ada', alt: 'Portrait' } })
    expect(host.querySelector('img')?.getAttribute('alt')).toBe('Portrait')
  })

  it('falls back to up to two uppercase initials without an image', async () => {
    const host = await render(Avatar, { props: { name: 'ada byron lovelace' } })

    expect(host.querySelector('img')).toBeNull()
    expect(host.querySelector('.avatar-fallback')?.textContent).toBe('AB')
  })

  it('shows name and email and hides the decorative image from assistive tech', async () => {
    const host = await render(Avatar, { props: { name: 'Ada', email: 'ada@example.com' } })

    expect(host.querySelector('.avatar-name')?.textContent).toBe('Ada')
    expect(host.querySelector('.avatar-email')?.textContent).toBe('ada@example.com')
    expect(host.querySelector('.avatar-image-wrapper')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('does not hide the image when there is no text info', async () => {
    const host = await render(Avatar, { props: { src: '/me.png', alt: 'Portrait' } })
    expect(host.querySelector('.avatar-image-wrapper')?.hasAttribute('aria-hidden')).toBe(false)
  })

  it('applies size and shape classes', async () => {
    const host = await render(Avatar, { props: { name: 'A', size: 'xl', shape: 'rounded' } })

    expect(host.querySelector('.avatar-wrapper')?.classList.contains('avatar-xl')).toBe(true)
    expect(host.querySelector('.avatar-image-wrapper')?.classList.contains('avatar-rounded')).toBe(
      true,
    )
  })
})
