// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

import { mountDom, runScript } from '../../../test-dom'
import { render } from '../../../test-render'

import Dropdown from './Dropdown.astro'

const items = [
  { label: 'Edit', href: '/edit' },
  { label: 'Archive' },
  { label: 'Delete', variant: 'destructive' as const, disabled: true },
  { label: 'Share' },
]

interface Mounted {
  wrapper: HTMLElement
  button: HTMLButtonElement
  item: (label: string) => HTMLElement
  isOpen: () => boolean
  focused: () => string | undefined
  press: (key: string, target?: HTMLElement) => KeyboardEvent
}

function required<T>(element: T | null, what: string): T {
  if (element === null) throw new Error(`${what} not rendered`)
  return element
}

function toMounted(wrapper: HTMLElement): Mounted {
  const button = required(
    wrapper.querySelector<HTMLButtonElement>('[data-dropdown-trigger] button'),
    'trigger',
  )
  const menuItems = [...wrapper.querySelectorAll<HTMLElement>('[role="menuitem"]')]

  return {
    wrapper,
    button,
    item: (label) =>
      required(menuItems.find((el) => el.textContent.trim() === label) ?? null, label),
    isOpen: () => wrapper.classList.contains('dropdown-open'),
    focused: () => {
      const { activeElement: active } = document
      return active instanceof HTMLElement && wrapper.contains(active)
        ? active.textContent.trim()
        : undefined
    },
    press: (key, target) => {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
      const origin =
        target ?? (document.activeElement instanceof HTMLElement ? document.activeElement : button)
      origin.dispatchEvent(event)
      return event
    },
  }
}

async function mountDropdowns(ids: string[]): Promise<Mounted[]> {
  const hosts = await Promise.all(
    ids.map(
      async (id) =>
        await render(Dropdown, {
          props: { id, items },
          slots: { default: '<button>Actions</button>' },
        }),
    ),
  )
  mountDom(`${hosts.map((host) => host.innerHTML).join('')}<p id="outside">Outside</p>`)
  await runScript(async () => await import('./dropdown-menu'))
  return [...document.querySelectorAll<HTMLElement>('[data-dropdown]')].map(toMounted)
}

describe('dropdown-menu', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('opens on trigger click, marks it expanded and focuses the first enabled item', async () => {
    const [dropdown] = await mountDropdowns(['actions'])

    dropdown.button.click()

    expect(dropdown.isOpen()).toBe(true)
    expect(dropdown.button.getAttribute('aria-expanded')).toBe('true')
    expect(dropdown.focused()).toBe('Edit')
  })

  it('closes on a second trigger click and marks it collapsed', async () => {
    const [dropdown] = await mountDropdowns(['actions'])

    dropdown.button.click()
    dropdown.button.click()

    expect(dropdown.isOpen()).toBe(false)
    expect(dropdown.button.getAttribute('aria-expanded')).toBe('false')
  })

  it('closes when an enabled item is clicked and stays open for a disabled one', async () => {
    const [dropdown] = await mountDropdowns(['actions'])
    dropdown.button.click()

    dropdown.item('Delete').click()
    expect(dropdown.isOpen()).toBe(true)

    dropdown.item('Archive').click()
    expect(dropdown.isOpen()).toBe(false)
    expect(dropdown.button.getAttribute('aria-expanded')).toBe('false')
  })

  it('closes on a click outside the dropdown', async () => {
    const [dropdown] = await mountDropdowns(['actions'])
    dropdown.button.click()

    required(document.querySelector<HTMLElement>('#outside'), 'outside').click()

    expect(dropdown.isOpen()).toBe(false)
    expect(dropdown.button.getAttribute('aria-expanded')).toBe('false')
  })

  it.each(['ArrowDown', 'Enter', ' '])('opens with %j pressed on the trigger', async (key) => {
    const [dropdown] = await mountDropdowns(['actions'])

    const event = dropdown.press(key, dropdown.button)

    expect(event.defaultPrevented).toBe(true)
    expect(dropdown.isOpen()).toBe(true)
    expect(dropdown.focused()).toBe('Edit')
  })

  it('ignores opening keys pressed outside the trigger while closed', async () => {
    const [dropdown] = await mountDropdowns(['actions'])

    const event = dropdown.press('ArrowDown', dropdown.item('Archive'))

    expect(event.defaultPrevented).toBe(false)
    expect(dropdown.isOpen()).toBe(false)
  })

  it('closes on Escape and returns focus to the trigger', async () => {
    const [dropdown] = await mountDropdowns(['actions'])
    dropdown.button.click()

    const event = dropdown.press('Escape')

    expect(event.defaultPrevented).toBe(true)
    expect(dropdown.isOpen()).toBe(false)
    expect(dropdown.button.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(dropdown.button)
  })

  it('moves focus with the arrow keys over enabled items and wraps around', async () => {
    const [dropdown] = await mountDropdowns(['actions'])
    dropdown.button.click()

    dropdown.press('ArrowDown')
    expect(dropdown.focused()).toBe('Archive')
    dropdown.press('ArrowDown')
    expect(dropdown.focused()).toBe('Share')
    dropdown.press('ArrowDown')
    expect(dropdown.focused()).toBe('Edit')
    dropdown.press('ArrowUp')
    expect(dropdown.focused()).toBe('Share')
    const event = dropdown.press('ArrowUp')
    expect(event.defaultPrevented).toBe(true)
    expect(dropdown.focused()).toBe('Archive')
  })

  it('jumps to the last item on End and the first on Home', async () => {
    const [dropdown] = await mountDropdowns(['actions'])
    dropdown.button.click()

    expect(dropdown.press('End').defaultPrevented).toBe(true)
    expect(dropdown.focused()).toBe('Share')
    expect(dropdown.press('Home').defaultPrevented).toBe(true)
    expect(dropdown.focused()).toBe('Edit')
  })

  it('leaves other keys alone while open', async () => {
    const [dropdown] = await mountDropdowns(['actions'])
    dropdown.button.click()

    const event = dropdown.press('Tab')

    expect(event.defaultPrevented).toBe(false)
    expect(dropdown.isOpen()).toBe(true)
    expect(dropdown.focused()).toBe('Edit')
  })

  it('toggles each dropdown exactly once per click when several share the page', async () => {
    const [first, second] = await mountDropdowns(['first', 'second'])

    second.button.click()
    expect(second.isOpen()).toBe(true)
    expect(first.isOpen()).toBe(false)

    second.button.click()
    expect(second.isOpen()).toBe(false)

    first.button.click()
    expect(first.isOpen()).toBe(true)
    expect(second.isOpen()).toBe(false)
  })
})
