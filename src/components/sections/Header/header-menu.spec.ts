// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

import { mountDom, runScript } from '../../../test-dom'
import { render } from '../../../test-render'

import Header from './Header.astro'

async function mountHeaders(count: number): Promise<HTMLElement[]> {
  const hosts = await Promise.all(
    Array.from(
      { length: count },
      async () =>
        await render(Header, {
          props: { brand: 'Acme', links: [{ label: 'Home', href: '/' }] },
        }),
    ),
  )
  mountDom(hosts.map((host) => host.innerHTML).join(''))
  await runScript(async () => await import('./header-menu'))
  return [...document.querySelectorAll<HTMLElement>('[data-header]')]
}

function part(header: HTMLElement, selector: string): HTMLElement {
  const element = header.querySelector<HTMLElement>(selector)
  if (element === null) throw new Error(`${selector} not rendered`)
  return element
}

function iconHidden(header: HTMLElement, icon: 'open' | 'close'): boolean {
  return part(header, `.header-icon-${icon}`).classList.contains('hidden')
}

function isOpen(header: HTMLElement): boolean {
  return header.classList.contains('header-open')
}

function pressKey(target: HTMLElement, key: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
}

describe('header-menu', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('opens the mobile menu and swaps to the close icon on first click', async () => {
    const [header] = await mountHeaders(1)
    const toggle = part(header, '[data-header-toggle]')

    toggle.click()

    expect(isOpen(header)).toBe(true)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(iconHidden(header, 'open')).toBe(true)
    expect(iconHidden(header, 'close')).toBe(false)
  })

  it('closes the mobile menu and restores the menu icon on second click', async () => {
    const [header] = await mountHeaders(1)
    const toggle = part(header, '[data-header-toggle]')

    toggle.click()
    toggle.click()

    expect(isOpen(header)).toBe(false)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(iconHidden(header, 'open')).toBe(false)
    expect(iconHidden(header, 'close')).toBe(true)
  })

  it('closes on Escape and returns focus to the toggle', async () => {
    const [header] = await mountHeaders(1)
    const toggle = part(header, '[data-header-toggle]')
    toggle.click()
    const link = part(header, '.header-mobile-menu .header-link')
    link.focus()

    pressKey(link, 'Escape')

    expect(isOpen(header)).toBe(false)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(iconHidden(header, 'open')).toBe(false)
    expect(document.activeElement).toBe(toggle)
  })

  it('ignores Escape while closed and other keys while open', async () => {
    const [header] = await mountHeaders(1)
    const toggle = part(header, '[data-header-toggle]')
    const brand = part(header, '.header-brand')
    brand.focus()

    pressKey(brand, 'Escape')
    expect(document.activeElement).toBe(brand)

    toggle.click()
    pressKey(toggle, 'Enter')
    expect(isOpen(header)).toBe(true)
  })

  it('opens on the first click and closes on the second for each header on the page', async () => {
    const headers = await mountHeaders(2)

    const [first, second] = headers
    const pairs: Array<[HTMLElement, HTMLElement]> = [
      [first, second],
      [second, first],
    ]

    for (const [header, other] of pairs) {
      const toggle = part(header, '[data-header-toggle]')

      toggle.click()
      expect(isOpen(header)).toBe(true)
      expect(isOpen(other)).toBe(false)

      toggle.click()
      expect(isOpen(header)).toBe(false)
      expect(toggle.getAttribute('aria-expanded')).toBe('false')
    }
  })
})
