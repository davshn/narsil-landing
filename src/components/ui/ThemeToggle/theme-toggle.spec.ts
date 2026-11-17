// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import ThemeToggle from './ThemeToggle.astro'

describe('ThemeToggle', () => {
  it('renders an icon button with the default accessible name', async () => {
    const host = await render(ThemeToggle)
    const button = host.querySelector('#theme-toggle')

    expect(button?.tagName).toBe('BUTTON')
    expect(button?.classList.contains('btn-icon')).toBe(true)
    expect(button?.getAttribute('aria-label')).toBe('Toggle theme')
    expect(button?.querySelectorAll('svg')).toHaveLength(2)
  })

  it('uses a localized label', async () => {
    const host = await render(ThemeToggle, { props: { label: 'Cambiar tema' } })
    expect(host.querySelector('#theme-toggle')?.getAttribute('aria-label')).toBe('Cambiar tema')
  })
})
