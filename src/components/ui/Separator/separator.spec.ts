// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import Separator from './Separator.astro'

describe('Separator', () => {
  it('renders a horizontal separator with default classes', async () => {
    const host = await render(Separator)
    const sep = host.querySelector('[role="separator"]')

    expect(sep?.getAttribute('aria-orientation')).toBe('horizontal')
    expect([...(sep?.classList ?? [])]).toEqual(
      expect.arrayContaining([
        'separator-horizontal',
        'separator-solid',
        'separator-md',
        'separator-default',
      ]),
    )
    expect(sep?.classList.contains('separator-with-content')).toBe(false)
  })

  it('reports vertical orientation', async () => {
    const host = await render(Separator, { props: { orientation: 'vertical' } })
    const sep = host.querySelector('[role="separator"]')

    expect(sep?.getAttribute('aria-orientation')).toBe('vertical')
    expect(sep?.classList.contains('separator-vertical')).toBe(true)
  })

  it.each(['solid', 'dashed', 'dotted'])('applies the separator-%s style', async (style) => {
    const host = await render(Separator, { props: { style } })
    expect(host.querySelector('.separator')?.classList.contains(`separator-${style}`)).toBe(true)
  })

  it('renders a label and decorative icon with the content position', async () => {
    const host = await render(Separator, {
      props: { label: 'or', icon: 'lucide:star', contentPosition: 'start' },
    })
    const sep = host.querySelector('.separator')

    expect(sep?.classList.contains('separator-with-content')).toBe(true)
    expect(sep?.classList.contains('separator-content-start')).toBe(true)
    expect(host.querySelector('.separator-label')?.textContent).toBe('or')
    expect(host.querySelector('svg.separator-icon')?.getAttribute('aria-hidden')).toBe('true')
  })
})
