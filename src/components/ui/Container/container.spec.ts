// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import Container from './Container.astro'

describe('Container', () => {
  it('renders a centered xl <div> with md padding by default', async () => {
    const host = await render(Container, { slots: { default: 'Content' } })
    const { firstElementChild: el } = host

    expect(el.tagName).toBe('DIV')
    expect([...el.classList]).toEqual(
      expect.arrayContaining(['container-base', 'container-xl', 'container-pad-md']),
    )
    expect(el.classList.contains('ml-0')).toBe(false)
    expect(el.textContent).toContain('Content')
  })

  it('renders the requested semantic tag and id', async () => {
    const host = await render(Container, { props: { as: 'section', id: 'about' } })
    const { firstElementChild: el } = host

    expect(el.tagName).toBe('SECTION')
    expect(el.id).toBe('about')
  })

  it.each(['xs', 'sm', 'md', 'lg', 'xl', 'full'])('applies container-%s', async (maxWidth) => {
    const host = await render(Container, { props: { maxWidth } })
    expect(host.firstElementChild.classList.contains(`container-${maxWidth}`)).toBe(true)
  })

  it.each(['none', 'sm', 'md', 'lg', 'section'])('applies container-pad-%s', async (padding) => {
    const host = await render(Container, { props: { padding } })
    expect(host.firstElementChild.classList.contains(`container-pad-${padding}`)).toBe(true)
  })

  it('aligns to the start when center is false', async () => {
    const host = await render(Container, { props: { center: false } })
    expect(host.firstElementChild.classList.contains('ml-0')).toBe(true)
  })
})
