// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

import { mountDom, runScript } from '../../../test-dom'
import { render } from '../../../test-render'

import Sidebar from './Sidebar.astro'

async function mountSidebars(count: number): Promise<HTMLElement[]> {
  const hosts = await Promise.all(
    Array.from(
      { length: count },
      async () =>
        await render(Sidebar, {
          props: { title: 'Menu', actions: [{ label: 'Home', href: '/' }] },
          slots: { default: 'Content' },
        }),
    ),
  )
  mountDom(hosts.map((host) => host.innerHTML).join(''))
  await runScript(async () => await import('./sidebar-toggle'))
  return [...document.querySelectorAll<HTMLElement>('[data-sidebar-container]')]
}

function part(container: HTMLElement, selector: string): HTMLElement {
  const element = container.querySelector<HTMLElement>(selector)
  if (element === null) throw new Error(`${selector} not rendered`)
  return element
}

function isOpen(container: HTMLElement): boolean {
  return container.classList.contains('sidebar-open')
}

function pressKey(target: HTMLElement, key: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
}

describe('sidebar-toggle', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('opens the sidebar and locks scrolling on first click', async () => {
    const [container] = await mountSidebars(1)
    const toggle = part(container, '[data-sidebar-toggle]')

    toggle.click()

    expect(isOpen(container)).toBe(true)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('closes the sidebar and unlocks scrolling on second click', async () => {
    const [container] = await mountSidebars(1)
    const toggle = part(container, '[data-sidebar-toggle]')

    toggle.click()
    toggle.click()

    expect(isOpen(container)).toBe(false)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(document.body.style.overflow).toBe('')
  })

  it('closes when the overlay is clicked', async () => {
    const [container] = await mountSidebars(1)
    const toggle = part(container, '[data-sidebar-toggle]')
    toggle.click()

    part(container, '[data-sidebar-overlay]').click()

    expect(isOpen(container)).toBe(false)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(document.body.style.overflow).toBe('')
  })

  it('closes on Escape and returns focus to the toggle', async () => {
    const [container] = await mountSidebars(1)
    const toggle = part(container, '[data-sidebar-toggle]')
    toggle.click()
    const action = part(container, '.sidebar-action')
    action.focus()

    pressKey(action, 'Escape')

    expect(isOpen(container)).toBe(false)
    expect(document.body.style.overflow).toBe('')
    expect(document.activeElement).toBe(toggle)
  })

  it('ignores Escape while closed and other keys while open', async () => {
    const [container] = await mountSidebars(1)
    const toggle = part(container, '[data-sidebar-toggle]')
    const action = part(container, '.sidebar-action')
    action.focus()

    pressKey(action, 'Escape')
    expect(document.activeElement).toBe(action)

    toggle.click()
    pressKey(toggle, 'Enter')
    expect(isOpen(container)).toBe(true)
  })

  it('opens on the first click and closes on the second for each sidebar on the page', async () => {
    const containers = await mountSidebars(2)

    const [first, second] = containers
    const pairs: Array<[HTMLElement, HTMLElement]> = [
      [first, second],
      [second, first],
    ]

    for (const [container, other] of pairs) {
      const toggle = part(container, '[data-sidebar-toggle]')

      toggle.click()
      expect(isOpen(container)).toBe(true)
      expect(isOpen(other)).toBe(false)

      toggle.click()
      expect(isOpen(container)).toBe(false)
      expect(toggle.getAttribute('aria-expanded')).toBe('false')
    }
  })
})
