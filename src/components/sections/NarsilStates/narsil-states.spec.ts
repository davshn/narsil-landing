// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import NarsilStates from './NarsilStates.astro'

const states = [
  { pose: 'trabajando', tone: 'working', label: 'Working', text: 'Claude is editing.' },
  { pose: 'error', tone: 'error', label: 'Error', text: 'A tool failed.' },
]

describe('NarsilStates', () => {
  it('renders one item per state with its tone, label, and text', async () => {
    const host = await render(NarsilStates, { props: { title: 'States', states } })
    const items = [...host.querySelectorAll('.narsil-state')]

    expect(items[0].classList.contains('narsil-state-working')).toBe(true)
    expect(items[1].classList.contains('narsil-state-error')).toBe(true)
    expect(items.map((item) => item.querySelector('.narsil-state-label')?.textContent)).toEqual([
      'Working',
      'Error',
    ])
    expect(items[1].querySelector('.narsil-state-text')?.textContent).toBe('A tool failed.')
  })

  it('draws each pose as decoration, since its label already names the state', async () => {
    const host = await render(NarsilStates, { props: { title: 'States', states } })
    const images = [...host.querySelectorAll('.narsil-state img')]

    expect(images[0].getAttribute('src')).toBe('/narsil/trabajando-claro.webp')
    expect(images.every((img) => img.getAttribute('alt') === '')).toBe(true)
  })

  it('renders the subtitle only when provided', async () => {
    const without = await render(NarsilStates, { props: { title: 'States', states } })
    const withIt = await render(NarsilStates, {
      props: { title: 'States', subtitle: 'At a glance', states },
    })

    expect(without.querySelector('.section-description')).toBeNull()
    expect(withIt.querySelector('.section-description')?.textContent).toBe('At a glance')
    expect(withIt.querySelector('h2')?.textContent).toBe('States')
  })
})
