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

    expect(without.querySelector('.narsil-states-subtitle')).toBeNull()
    expect(withIt.querySelector('.narsil-states-subtitle')?.textContent).toBe('At a glance')
    expect(withIt.querySelector('h2')?.textContent.trim()).toBe('States')
  })

  it('renders the intro beside the states only when it has paragraphs', async () => {
    const without = await render(NarsilStates, { props: { title: 'States', states } })
    const withIt = await render(NarsilStates, {
      props: {
        title: 'States',
        introTitle: 'What is Narsil?',
        intro: ['A pet above the prompt.', 'Built step by step.'],
        states,
      },
    })

    expect(without.querySelector('.narsil-states-intro')).toBeNull()
    expect(withIt.querySelector('.narsil-states-intro h2')?.textContent).toBe('What is Narsil?')
    expect(
      [...withIt.querySelectorAll('.narsil-states-paragraph')].map((p) => p.textContent),
    ).toEqual(['A pet above the prompt.', 'Built step by step.'])
  })

  it('makes the row of poses a named, focusable region so it scrolls by keyboard', async () => {
    const host = await render(NarsilStates, { props: { title: 'States', states } })
    const region = host.querySelector('.narsil-states-scroller')

    expect(region?.getAttribute('role')).toBe('region')
    expect(region?.getAttribute('tabindex')).toBe('0')
    expect(region?.getAttribute('aria-labelledby')).toBe('narsil-states-title')
    expect(host.querySelector('#narsil-states-title')?.textContent.trim()).toBe('States')
  })
})
