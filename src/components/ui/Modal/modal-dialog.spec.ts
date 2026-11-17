// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

import { mountDom, runScript } from '../../../test-dom'
import { render } from '../../../test-render'

import Modal from './Modal.astro'

async function mountModals(ids: string[]): Promise<HTMLElement[]> {
  const hosts = await Promise.all(
    ids.map(
      async (id) =>
        await render(Modal, { props: { id, title: `Title ${id}` }, slots: { default: 'Body' } }),
    ),
  )
  const triggers = ids.map((id) => `<button type="button" data-trigger="${id}">Open</button>`)
  mountDom(triggers.join('') + hosts.map((host) => host.innerHTML).join(''))
  await runScript(async () => await import('./modal-dialog'))
  return [...document.querySelectorAll<HTMLElement>('[data-modal]')]
}

function trigger(id: string): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>(`[data-trigger="${id}"]`)
  if (button === null) throw new Error(`trigger ${id} not mounted`)
  return button
}

function closeButton(overlay: HTMLElement): HTMLButtonElement {
  const button = overlay.querySelector<HTMLButtonElement>('[data-modal-close]')
  if (button === null) throw new Error('close button not rendered')
  return button
}

function openFrom(id: string): void {
  trigger(id).focus()
  window.dispatchEvent(new CustomEvent('modal:open', { detail: id }))
}

describe('modal-dialog', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('opens on modal:open, locks scrolling and focuses the close button', async () => {
    const [overlay] = await mountModals(['demo'])

    openFrom('demo')

    expect(overlay.dataset.open).toBe('true')
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.activeElement).toBe(closeButton(overlay))
  })

  it('ignores modal:open events for another id', async () => {
    const [overlay] = await mountModals(['demo'])

    window.dispatchEvent(new CustomEvent('modal:open', { detail: 'other' }))

    expect(overlay.dataset.open).toBe('false')
    expect(document.body.style.overflow).toBe('')
  })

  it('closes from the close button, unlocks scrolling and restores focus', async () => {
    const [overlay] = await mountModals(['demo'])
    openFrom('demo')

    closeButton(overlay).click()

    expect(overlay.dataset.open).toBe('false')
    expect(document.body.style.overflow).toBe('')
    expect(document.activeElement).toBe(trigger('demo'))
  })

  it('closes when the overlay itself is clicked but not when the dialog content is', async () => {
    const [overlay] = await mountModals(['demo'])
    openFrom('demo')

    overlay.querySelector<HTMLElement>('.modal-body')?.click()
    expect(overlay.dataset.open).toBe('true')

    overlay.click()
    expect(overlay.dataset.open).toBe('false')
  })

  it('closes on Escape and ignores other keys', async () => {
    const [overlay] = await mountModals(['demo'])
    openFrom('demo')
    const button = closeButton(overlay)

    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(overlay.dataset.open).toBe('true')

    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(overlay.dataset.open).toBe('false')
    expect(document.activeElement).toBe(trigger('demo'))
  })

  it('closes on a matching modal:close event only', async () => {
    const [overlay] = await mountModals(['demo'])
    openFrom('demo')

    window.dispatchEvent(new CustomEvent('modal:close', { detail: 'other' }))
    expect(overlay.dataset.open).toBe('true')

    window.dispatchEvent(new CustomEvent('modal:close', { detail: 'demo' }))
    expect(overlay.dataset.open).toBe('false')
    expect(document.body.style.overflow).toBe('')
  })

  it('opens and closes each modal once when several modals share the page', async () => {
    const overlays = await mountModals(['first', 'second'])

    const [first, second] = overlays
    const cases: Array<[HTMLElement, HTMLElement, string]> = [
      [first, second, 'first'],
      [second, first, 'second'],
    ]

    for (const [overlay, other, id] of cases) {
      openFrom(id)
      expect(overlay.dataset.open).toBe('true')
      expect(other.dataset.open).toBe('false')

      closeButton(overlay).click()
      expect(overlay.dataset.open).toBe('false')
      expect(document.activeElement).toBe(trigger(id))
    }
  })
})
