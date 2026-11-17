// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import SkipToContent from './SkipToContent.astro'

describe('SkipToContent', () => {
  it('links to #main-content with a default label', async () => {
    const host = await render(SkipToContent)
    const link = host.querySelector('a.skip-to-content')

    expect(link?.getAttribute('href')).toBe('#main-content')
    expect(link?.textContent.trim()).toBe('Skip to content')
  })

  it('accepts a custom target and a localized label', async () => {
    const host = await render(SkipToContent, {
      props: { target: 'content', label: 'Ir al contenido' },
    })
    const link = host.querySelector('a.skip-to-content')

    expect(link?.getAttribute('href')).toBe('#content')
    expect(link?.textContent.trim()).toBe('Ir al contenido')
  })
})
