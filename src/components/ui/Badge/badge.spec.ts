// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import Badge from './Badge.astro'

describe('Badge', () => {
  it('renders a soft, default, md badge with its content', async () => {
    const host = await render(Badge, { slots: { default: 'New' } })
    const badge = host.querySelector('.badge')

    expect(badge?.tagName).toBe('SPAN')
    expect([...(badge?.classList ?? [])]).toEqual(
      expect.arrayContaining(['badge-soft', 'badge-default', 'badge-md']),
    )
    expect(badge?.textContent).toContain('New')
  })

  it.each(['soft', 'outline', 'solid'])('applies the badge-%s variant', async (variant) => {
    const host = await render(Badge, { props: { variant } })
    expect(host.querySelector('.badge')?.classList.contains(`badge-${variant}`)).toBe(true)
  })

  it.each(['default', 'primary', 'secondary', 'accent', 'success', 'warning', 'destructive'])(
    'applies the badge-%s color',
    async (color) => {
      const host = await render(Badge, { props: { color } })
      expect(host.querySelector('.badge')?.classList.contains(`badge-${color}`)).toBe(true)
    },
  )

  it('renders a decorative icon only when requested', async () => {
    const withIcon = await render(Badge, { props: { icon: 'lucide:check' } })
    const withoutIcon = await render(Badge)

    expect(withIcon.querySelector('svg.badge-icon')?.getAttribute('aria-hidden')).toBe('true')
    expect(withoutIcon.querySelector('svg')).toBeNull()
  })
})
