// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import Card from './Card.astro'
import CardBody from './CardBody.astro'
import CardFooter from './CardFooter.astro'
import CardHeader from './CardHeader.astro'
import CardImage from './CardImage.astro'

const scriptHref = ['javascript', 'alert(1)'].join(':')

describe('Card', () => {
  it('renders a non-link card for an unsafe href', async () => {
    const host = await render(Card, { props: { href: scriptHref }, slots: { default: 'Body' } })

    expect(host.querySelector('a')).toBeNull()
    expect(host.querySelector('div.card')?.textContent).toContain('Body')
  })

  it('renders a plain, non-focusable <div> by default', async () => {
    const host = await render(Card, { slots: { default: 'Body' } })
    const { firstElementChild: card } = host

    expect(card.tagName).toBe('DIV')
    expect(card.className).toBe('card')
    expect(card.hasAttribute('tabindex')).toBe(false)
    expect(card.textContent).toContain('Body')
  })

  it.each(['elevated', 'outlined', 'ghost'])('applies the card-%s variant', async (variant) => {
    const host = await render(Card, { props: { variant } })
    expect(host.firstElementChild.classList.contains(`card-${variant}`)).toBe(true)
  })

  it('adds a size class only for non-default sizes', async () => {
    const small = await render(Card, { props: { size: 'sm' } })
    const medium = await render(Card, { props: { size: 'md' } })

    expect(small.firstElementChild.classList.contains('card-sm')).toBe(true)
    expect(medium.firstElementChild.className).toBe('card')
  })

  it('makes an interactive div keyboard focusable', async () => {
    const host = await render(Card, { props: { interactive: true } })
    const { firstElementChild: card } = host

    expect(card.classList.contains('card-interactive')).toBe(true)
    expect(card.getAttribute('tabindex')).toBe('0')
  })

  it('renders a link card as an <a> without an extra tabindex', async () => {
    const host = await render(Card, { props: { href: '/plans' } })
    const { firstElementChild: card } = host

    expect(card.tagName).toBe('A')
    expect(card.getAttribute('href')).toBe('/plans')
    expect(card.classList.contains('card-interactive')).toBe(true)
    expect(card.hasAttribute('tabindex')).toBe(false)
  })
})

describe('Card parts', () => {
  it.each([
    [CardHeader, 'card-header'],
    [CardBody, 'card-body'],
    [CardFooter, 'card-footer'],
  ] as const)('renders its slot inside .%s and merges classes', async (Part, cls) => {
    const host = await render(Part, { props: { class: 'extra' }, slots: { default: 'Slot' } })
    const { firstElementChild: el } = host

    expect(el.classList.contains(cls)).toBe(true)
    expect(el.classList.contains('extra')).toBe(true)
    expect(el.textContent).toContain('Slot')
  })

  it('renders a lazy image with alt text', async () => {
    const host = await render(CardImage, { props: { src: '/cover.png', alt: 'Cover' } })
    const img = host.querySelector('.card-image img')

    expect(img?.getAttribute('src')).toBe('/cover.png')
    expect(img?.getAttribute('alt')).toBe('Cover')
    expect(img?.getAttribute('loading')).toBe('lazy')
  })
})
