// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

import { mountDom, runScript, setColorScheme } from '../../../test-dom'
import { render } from '../../../test-render'

import ThemeToggle from './ThemeToggle.astro'

async function mountToggle(
  options: { scheme?: 'light' | 'dark'; stored?: string } = {},
): Promise<HTMLButtonElement> {
  const host = await render(ThemeToggle)
  mountDom(host.innerHTML)
  setColorScheme(options.scheme ?? 'light')
  if (options.stored !== undefined) window.localStorage.setItem('theme', options.stored)
  await runScript(async () => await import('./theme-toggle'))
  const button = document.querySelector<HTMLButtonElement>('#theme-toggle')
  if (button === null) throw new Error('theme toggle not rendered')
  return button
}

function isDark(): boolean {
  return document.documentElement.classList.contains('dark')
}

function clickTimes<T>(button: HTMLButtonElement, times: number, read: () => T): T[] {
  return Array.from({ length: times }, () => {
    button.click()
    return read()
  })
}

describe('theme-toggle script', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('cycles system, light, dark and back to system, storing each mode', async () => {
    const button = await mountToggle()

    expect(clickTimes(button, 3, () => window.localStorage.getItem('theme'))).toEqual([
      'light',
      'dark',
      'system',
    ])
  })

  it('applies dark only for dark mode, or for system mode when the OS prefers dark', async () => {
    const button = await mountToggle({ scheme: 'dark' })

    expect(clickTimes(button, 3, isDark)).toEqual([false, true, true])
  })

  it('treats an unknown stored value as the start of the cycle', async () => {
    const button = await mountToggle({ stored: 'sepia' })

    button.click()

    expect(window.localStorage.getItem('theme')).toBe('system')
  })

  it('follows OS preference changes only while in system mode', async () => {
    const button = await mountToggle()

    setColorScheme('dark')
    expect(isDark()).toBe(true)

    button.click()
    setColorScheme('light')
    setColorScheme('dark')
    expect(isDark()).toBe(false)
  })

  it('still switches the theme when storage is unavailable', async () => {
    const button = await mountToggle()
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    expect(clickTimes(button, 2, isDark)).toEqual([false, false])
  })

  it('does nothing on a page without the toggle', async () => {
    mountDom('<main></main>')

    await expect(runScript(async () => await import('./theme-toggle'))).resolves.toBeUndefined()
  })
})
