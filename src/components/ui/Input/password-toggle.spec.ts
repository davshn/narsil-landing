// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

import { mountDom, runScript } from '../../../test-dom'
import { render } from '../../../test-render'

import Input from './Input.astro'

async function loadScript(): Promise<void> {
  await runScript(async () => await import('./password-toggle'))
}

async function mountPassword(): Promise<{ input: HTMLInputElement; toggle: HTMLButtonElement }> {
  const host = await render(Input, { props: { name: 'pwd', type: 'password' } })
  mountDom(host.innerHTML)
  await loadScript()

  const input = document.querySelector<HTMLInputElement>('#pwd')
  const toggle = document.querySelector<HTMLButtonElement>('[data-password-toggle="pwd"]')
  if (input === null || toggle === null) throw new Error('password input not rendered')
  return { input, toggle }
}

function iconHidden(toggle: HTMLElement, icon: 'show' | 'hide'): boolean | undefined {
  return toggle.querySelector(`.password-icon-${icon}`)?.classList.contains('hidden')
}

describe('password-toggle', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reveals the password and swaps to the hide icon on first click', async () => {
    const { input, toggle } = await mountPassword()

    toggle.click()

    expect(input.type).toBe('text')
    expect(iconHidden(toggle, 'show')).toBe(true)
    expect(iconHidden(toggle, 'hide')).toBe(false)
  })

  it('hides the password again on a second click', async () => {
    const { input, toggle } = await mountPassword()

    toggle.click()
    toggle.click()

    expect(input.type).toBe('password')
    expect(iconHidden(toggle, 'show')).toBe(false)
    expect(iconHidden(toggle, 'hide')).toBe(true)
  })

  it('ignores toggles that point to a missing or non-input element', async () => {
    mountDom(`
      <button data-password-toggle="">empty</button>
      <button data-password-toggle="missing">missing</button>
      <div id="not-input"></div>
      <button data-password-toggle="not-input">div</button>
    `)
    await loadScript()
    const buttons = Array.from(document.querySelectorAll('button'))

    const clickAll = (): void => {
      for (const button of buttons) button.click()
    }

    expect(clickAll).not.toThrow()
  })
})
