// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

import { mountDom, runScript } from '../../../test-dom'
import { render } from '../../../test-render'

import GuideToc from './GuideToc.astro'

const entries = [
  { depth: 2, slug: 'what-it-does', text: 'What it does' },
  { depth: 3, slug: 'one-svg', text: 'One SVG' },
  { depth: 2, slug: 'going-further', text: 'Going further' },
] as const

async function mountToc(tops: Record<string, number>): Promise<HTMLAnchorElement[]> {
  const host = await render(GuideToc, { props: { entries } })
  const headings = Object.keys(tops)
    .map((id) => `<h2 id="${id}">${id}</h2>`)
    .join('')
  mountDom(`${host.innerHTML}${headings}`)
  for (const [id, top] of Object.entries(tops)) {
    const heading = document.getElementById(id)
    if (heading === null) throw new Error(`missing heading ${id}`)
    vi.spyOn(heading, 'getBoundingClientRect').mockReturnValue(new window.DOMRect(0, top, 0, 0))
  }
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    callback(performance.now())
    return 1
  })
  await runScript(async () => await import('./guide-toc'))
  return [...document.querySelectorAll<HTMLAnchorElement>('[data-guide-toc] a')]
}

const current = (links: HTMLAnchorElement[]): string[] =>
  links.filter((link) => link.getAttribute('aria-current') === 'location').map((link) => link.hash)

describe('GuideToc', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('links each heading by its slug and indents the ### ones', async () => {
    const host = await render(GuideToc, { props: { entries } })
    const items = [...host.querySelectorAll('.guide-toc-item')]

    expect(items.map((item) => item.querySelector('a')?.getAttribute('href'))).toEqual([
      '#what-it-does',
      '#one-svg',
      '#going-further',
    ])
    expect(items[1].classList.contains('guide-toc-depth-3')).toBe(true)
    expect(items[0].classList.contains('guide-toc-depth-2')).toBe(true)
  })

  it('marks the heading the reader has scrolled to as the current location', async () => {
    const links = await mountToc({ 'what-it-does': -500, 'one-svg': 40, 'going-further': 900 })

    expect(current(links)).toEqual(['#one-svg'])
  })

  it('moves the mark as the page scrolls', async () => {
    const links = await mountToc({ 'what-it-does': 300, 'one-svg': 900, 'going-further': 1500 })
    expect(current(links)).toEqual(['#what-it-does'])

    for (const [id, top] of Object.entries({
      'what-it-does': -1100,
      'one-svg': -500,
      'going-further': 100,
    })) {
      const heading = document.getElementById(id)
      if (heading === null) throw new Error(`missing heading ${id}`)
      vi.spyOn(heading, 'getBoundingClientRect').mockReturnValue(new window.DOMRect(0, top, 0, 0))
    }
    window.dispatchEvent(new Event('scroll'))

    expect(current(links)).toEqual(['#going-further'])
  })
})
