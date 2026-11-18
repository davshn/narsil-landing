// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

import { mountDom, runScript } from '../../../test-dom'
import { render } from '../../../test-render'

import Showcase from './Showcase.astro'

const shot = { light: '/light.png', dark: '/dark.png', width: 300, height: 600 }
const items = [
  { ...shot, title: 'Window', text: 'Always on top.', alt: 'The window', frame: 'window' },
  { ...shot, title: 'Panel', text: 'Beside the chat.', alt: 'The panel', frame: 'pane' },
  { ...shot, title: 'Phone', text: 'In your pocket.', alt: 'The phone', frame: 'phone' },
]

async function mountShowcase(withScript = true): Promise<void> {
  const host = await render(Showcase, { props: { title: 'How it looks', items } })
  mountDom(host.innerHTML)
  if (withScript) {
    await runScript(async () => {
      await import('./showcase-tabs')
    })
  }
}

const tabs = (): HTMLButtonElement[] => [
  ...document.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
]
const visiblePanels = (): string[] =>
  [...document.querySelectorAll<HTMLElement>('[data-showcase-panel]')]
    .filter((panel) => !panel.hasAttribute('hidden'))
    .map((panel) => panel.id)
const press = (tab: HTMLButtonElement, key: string): void => {
  tab.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
}

describe('showcase tabs', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows every capture and hides the tabs when the script does not run', async () => {
    await mountShowcase(false)

    expect(document.querySelector('[role="tablist"]')?.hasAttribute('hidden')).toBe(true)
    expect(visiblePanels()).toEqual(['showcase-panel-0', 'showcase-panel-1', 'showcase-panel-2'])
  })

  it('turns the captures into tab panels and shows only the first one', async () => {
    await mountShowcase()

    expect(document.querySelector('[role="tablist"]')?.hasAttribute('hidden')).toBe(false)
    expect(visiblePanels()).toEqual(['showcase-panel-0'])
    expect(tabs().map((tab) => tab.getAttribute('aria-selected'))).toEqual([
      'true',
      'false',
      'false',
    ])
    expect(document.querySelector('#showcase-panel-1')?.getAttribute('role')).toBe('tabpanel')
    expect(document.querySelector('#showcase-panel-1')?.getAttribute('aria-labelledby')).toBe(
      'showcase-tab-1',
    )
  })

  it('switches the capture when a tab is clicked', async () => {
    await mountShowcase()
    tabs()[2].click()

    expect(visiblePanels()).toEqual(['showcase-panel-2'])
    expect(tabs().map((tab) => tab.getAttribute('tabindex'))).toEqual(['-1', '-1', '0'])
  })

  it('moves between tabs with the arrow keys, wrapping around, and with Home and End', async () => {
    await mountShowcase()
    const [first] = tabs()

    press(first, 'ArrowLeft')
    expect(visiblePanels()).toEqual(['showcase-panel-2'])
    expect(document.activeElement?.id).toBe('showcase-tab-2')

    press(tabs()[2], 'ArrowRight')
    expect(visiblePanels()).toEqual(['showcase-panel-0'])

    press(first, 'End')
    expect(visiblePanels()).toEqual(['showcase-panel-2'])

    press(tabs()[2], 'Home')
    expect(visiblePanels()).toEqual(['showcase-panel-0'])
  })

  it('ignores other keys', async () => {
    await mountShowcase()
    press(tabs()[0], 'Enter')

    expect(visiblePanels()).toEqual(['showcase-panel-0'])
  })
})
