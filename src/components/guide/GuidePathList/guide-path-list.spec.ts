// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import GuidePathList from './GuidePathList.astro'

const props = {
  pathTitle: 'Your own status pet',
  pathHref: '/en/mods/pet/',
  progressLabel: 'Guide 2 of 3',
  guides: [
    { title: 'States', href: '/en/mods/pet/states/', isCurrent: false },
    { title: 'Drawing', href: '/en/mods/pet/drawing/', isCurrent: true },
    { title: 'Window', href: '/en/mods/pet/window/', isCurrent: false },
  ],
}

describe('GuidePathList', () => {
  it('links every guide of the path in order with its number', async () => {
    const host = await render(GuidePathList, { props })
    const links = [...host.querySelectorAll('.guide-path-link')]

    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/en/mods/pet/states/',
      '/en/mods/pet/drawing/',
      '/en/mods/pet/window/',
    ])
    expect(
      links.map((link) => link.querySelector('.guide-path-number')?.textContent.trim()),
    ).toEqual(['1', '2', '3'])
  })

  it('marks the current guide as the page and the earlier ones as done', async () => {
    const host = await render(GuidePathList, { props })
    const [first, current, last] = [...host.querySelectorAll('.guide-path-link')]

    expect(current.getAttribute('aria-current')).toBe('page')
    expect(first.hasAttribute('aria-current')).toBe(false)
    expect(first.hasAttribute('data-done')).toBe(true)
    expect(last.hasAttribute('data-done')).toBe(false)
  })

  it('links the path title and fills the progress bar to the current step', async () => {
    const host = await render(GuidePathList, { props })

    expect(host.querySelector('.guide-path-title')?.getAttribute('href')).toBe('/en/mods/pet/')
    expect(host.querySelector('.guide-path-progress')?.textContent).toContain('Guide 2 of 3')
    expect(host.querySelector('.guide-path-fill')?.getAttribute('style')).toBe('width: 67%')
    expect(host.querySelector('.guide-path-track')?.getAttribute('aria-hidden')).toBe('true')
  })
})
