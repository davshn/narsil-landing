// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import Timeline from './Timeline.astro'

const items = [
  { title: 'Ordered', description: 'Confirmed', icon: 'lucide:check' },
  { title: 'Shipped', color: 'success' as const, active: true },
  { title: 'Delivered' },
]

describe('Timeline', () => {
  it('renders a vertical list with one listitem per entry', async () => {
    const host = await render(Timeline, { props: { items } })
    const list = host.querySelector('[role="list"]')

    expect(list?.classList.contains('timeline-vertical')).toBe(true)
    expect(list?.querySelectorAll('[role="listitem"]')).toHaveLength(3)
    expect([...host.querySelectorAll('.timeline-title')].map((t) => t.textContent)).toEqual([
      'Ordered',
      'Shipped',
      'Delivered',
    ])
  })

  it('renders descriptions only when provided', async () => {
    const host = await render(Timeline, { props: { items } })
    expect(host.querySelectorAll('.timeline-description')).toHaveLength(1)
  })

  it('connects every item except the last', async () => {
    const host = await render(Timeline, { props: { items } })
    const entries = host.querySelectorAll('.timeline-item')

    expect(host.querySelectorAll('.timeline-connector')).toHaveLength(2)
    expect(entries[2].querySelector('.timeline-connector')).toBeNull()
  })

  it('uses a decorative icon or a dot, the item color and the active state', async () => {
    const host = await render(Timeline, { props: { items } })
    const [first, second] = [...host.querySelectorAll('.timeline-item')]

    expect(first.querySelector('svg.timeline-dot-icon')?.getAttribute('aria-hidden')).toBe('true')
    expect(second.querySelector('.timeline-dot-circle')).not.toBeNull()
    expect(first.classList.contains('timeline-item-primary')).toBe(true)
    expect(second.classList.contains('timeline-item-success')).toBe(true)
    expect(second.classList.contains('timeline-item-active')).toBe(true)
    expect(first.classList.contains('timeline-item-active')).toBe(false)
  })

  it('supports horizontal orientation', async () => {
    const host = await render(Timeline, { props: { items, orientation: 'horizontal' } })
    expect(host.querySelector('.timeline')?.classList.contains('timeline-horizontal')).toBe(true)
  })
})
