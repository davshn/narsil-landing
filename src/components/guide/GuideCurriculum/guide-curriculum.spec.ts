// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import GuideCurriculum from './GuideCurriculum.astro'

const items = [
  { title: 'States', description: 'Five states.', href: '/en/mods/pet/states/', meta: '13 min' },
  { title: 'Drawing', description: 'One pose per state.', href: '/en/mods/pet/drawing/' },
  { title: 'Window', description: 'Always on top.', href: '/en/mods/pet/window/', meta: '' },
]

describe('GuideCurriculum', () => {
  it('links every guide in order, numbered from one', async () => {
    const host = await render(GuideCurriculum, { props: { items } })
    const list = host.querySelector('ol[data-guide-list]')
    const entries = [...host.querySelectorAll('.curriculum-item')]

    expect(list).not.toBeNull()
    expect(entries.map((entry) => entry.querySelector('a')?.getAttribute('href'))).toEqual([
      '/en/mods/pet/states/',
      '/en/mods/pet/drawing/',
      '/en/mods/pet/window/',
    ])
    expect(
      entries.map((entry) => entry.querySelector('.curriculum-number')?.textContent.trim()),
    ).toEqual(['1', '2', '3'])
    expect(entries[0].querySelector('.curriculum-number')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('alternates the sides of the rail and places each guide on its own row', async () => {
    const host = await render(GuideCurriculum, { props: { items } })
    const entries = [...host.querySelectorAll('.curriculum-item')]

    expect(entries.map((entry) => entry.classList.contains('curriculum-item-start'))).toEqual([
      true,
      false,
      true,
    ])
    expect(entries.map((entry) => entry.getAttribute('style'))).toEqual([
      '--curriculum-row: 1',
      '--curriculum-row: 2',
      '--curriculum-row: 3',
    ])
  })

  it('shows the title, the description, and the reading time only when there is one', async () => {
    const host = await render(GuideCurriculum, { props: { items } })
    const [first, second, third] = [...host.querySelectorAll('.curriculum-card')]

    expect(first.querySelector('.curriculum-title')?.textContent).toBe('States')
    expect(first.querySelector('.curriculum-description')?.textContent).toBe('Five states.')
    expect(first.querySelector('.curriculum-meta')?.textContent).toBe('13 min')
    expect(second.querySelector('.curriculum-meta')).toBeNull()
    expect(third.querySelector('.curriculum-meta')).toBeNull()
  })
})
