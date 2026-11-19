// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import NarsilBubble from './NarsilBubble.astro'

describe('NarsilBubble', () => {
  it('renders the text as a paragraph with its tail pointing down by default', async () => {
    const host = await render(NarsilBubble, { slots: { default: 'Hi, I am Narsil.' } })
    const bubble = host.querySelector('.narsil-bubble')

    expect(bubble?.tagName).toBe('P')
    expect(bubble?.textContent).toBe('Hi, I am Narsil.')
    expect(bubble?.classList.contains('narsil-bubble-tail-down')).toBe(true)
  })

  it('points its tail to the left, renders as a div, and keeps extra classes when asked', async () => {
    const host = await render(NarsilBubble, {
      props: { tail: 'left', as: 'div', class: 'hero-bubble' },
      slots: { default: 'Over here.' },
    })
    const bubble = host.querySelector('.narsil-bubble')

    expect(bubble?.tagName).toBe('DIV')
    expect(bubble?.getAttribute('class')).toBe('narsil-bubble narsil-bubble-tail-left hero-bubble')
  })
})
