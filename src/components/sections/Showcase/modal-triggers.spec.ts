// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

import { en } from '../../../i18n/locales/en'
import { mountDom, runScript } from '../../../test-dom'
import { render } from '../../../test-render'

import ModalShowcase from './ModalShowcase.astro'

async function loadScript(): Promise<void> {
  await runScript(async () => await import('./modal-triggers'))
}

function recordOpenedModals(): unknown[] {
  const opened: unknown[] = []
  window.addEventListener('modal:open', (event) => {
    if (event instanceof CustomEvent) opened.push(event.detail)
  })
  return opened
}

describe('modal-triggers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('dispatches modal:open with the target modal id when a trigger is clicked', async () => {
    const host = await render(ModalShowcase, { props: { t: en } })
    mountDom(host.innerHTML)
    await loadScript()
    const opened = recordOpenedModals()

    document.querySelector<HTMLButtonElement>('[data-open-modal="demo-modal-lg"]')?.click()

    expect(opened).toEqual(['demo-modal-lg'])
  })

  it('does not dispatch for a trigger without a modal id', async () => {
    mountDom('<button data-open-modal="">no target</button>')
    await loadScript()
    const opened = recordOpenedModals()

    document.querySelector('button')?.click()

    expect(opened).toEqual([])
  })
})
