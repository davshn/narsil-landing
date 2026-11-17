// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

import { mountDom, runScript } from '../../../test-dom'
import { render } from '../../../test-render'

import Alert from './Alert.astro'

async function mountAlerts(propsList: Array<Record<string, unknown>>): Promise<HTMLElement[]> {
  const hosts = await Promise.all(
    propsList.map(async (props) => await render(Alert, { props, slots: { default: 'Saved' } })),
  )
  mountDom(hosts.map((host) => host.innerHTML).join(''))
  await runScript(async () => await import('./alert-dismiss'))
  return [...document.querySelectorAll<HTMLElement>('[data-alert]')]
}

describe('alert-dismiss', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('starts the closing animation and removes the alert when it ends', async () => {
    const [alert] = await mountAlerts([{ dismissible: true }])

    alert.querySelector<HTMLButtonElement>('[data-alert-dismiss]')?.click()

    expect(alert.classList.contains('alert-closing')).toBe(true)
    alert.dispatchEvent(new Event('animationend'))
    expect(document.querySelector('[data-alert]')).toBeNull()
  })

  it('closes each alert once when several alerts share the page', async () => {
    const alerts = await mountAlerts([{ dismissible: true }, { dismissible: true }])
    const removeSpy = vi.spyOn(alerts[0], 'remove')

    alerts[0].querySelector<HTMLButtonElement>('[data-alert-dismiss]')?.click()
    alerts[0].dispatchEvent(new Event('animationend'))

    expect(removeSpy).toHaveBeenCalledTimes(1)
    expect(alerts[1].classList.contains('alert-closing')).toBe(false)
  })

  it('closes automatically after autoClose milliseconds', async () => {
    vi.useFakeTimers()
    const [alert] = await mountAlerts([{ autoClose: 3000 }])

    vi.advanceTimersByTime(2999)
    expect(alert.classList.contains('alert-closing')).toBe(false)
    vi.advanceTimersByTime(1)
    expect(alert.classList.contains('alert-closing')).toBe(true)
  })

  it('stays open without autoClose', async () => {
    vi.useFakeTimers()
    const [alert] = await mountAlerts([{}])

    vi.advanceTimersByTime(60_000)
    expect(alert.classList.contains('alert-closing')).toBe(false)
  })
})
