// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import Text from './Text.astro'

describe('Text', () => {
  it('renders a regular base <p> with the default tone', async () => {
    const host = await render(Text, { slots: { default: 'Hello' } })
    const { firstElementChild: el } = host

    expect(el.tagName).toBe('P')
    expect([...el.classList]).toEqual(
      expect.arrayContaining(['text-size-base', 'text-tone-default', 'text-weight-regular']),
    )
    expect(el.textContent).toContain('Hello')
  })

  it.each([
    ['h1', '4xl', 'bold'],
    ['h2', '3xl', 'bold'],
    ['h3', '2xl', 'semibold'],
    ['h4', 'xl', 'semibold'],
    ['h5', 'lg', 'medium'],
    ['h6', 'base', 'medium'],
    ['label', 'sm', 'medium'],
  ])('derives size and weight from <%s>', async (as, size, weight) => {
    const host = await render(Text, { props: { as } })
    const { firstElementChild: el } = host

    expect(el.tagName).toBe(as.toUpperCase())
    expect(el.classList.contains(`text-size-${size}`)).toBe(true)
    expect(el.classList.contains(`text-weight-${weight}`)).toBe(true)
  })

  it('lets explicit size, weight and tone override the tag defaults', async () => {
    const host = await render(Text, {
      props: { as: 'h1', size: 'sm', weight: 'regular', tone: 'muted', id: 'intro' },
    })
    const { firstElementChild: el } = host

    expect([...el.classList]).toEqual(
      expect.arrayContaining(['text-size-sm', 'text-weight-regular', 'text-tone-muted']),
    )
    expect(el.classList.contains('text-size-4xl')).toBe(false)
    expect(el.id).toBe('intro')
  })
})
