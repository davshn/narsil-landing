import { Window } from 'happy-dom'
import { vi } from 'vitest'

const DOM_GLOBALS = [
  'document',
  'HTMLElement',
  'HTMLInputElement',
  'HTMLButtonElement',
  'Node',
  'Event',
  'CustomEvent',
  'KeyboardEvent',
  'HashChangeEvent',
] as const

let currentWindow: Window | undefined = undefined

export function mountDom(html: string, url = 'http://localhost/'): void {
  const window = new Window({ url })
  currentWindow = window
  window.document.body.innerHTML = html.replace(/<script[\s\S]*?<\/script>/gv, '')

  vi.stubGlobal('window', window)
  for (const key of DOM_GLOBALS) {
    vi.stubGlobal(key, window[key])
  }
}

export function setColorScheme(scheme: 'light' | 'dark'): void {
  if (currentWindow === undefined) throw new Error('mountDom() must run before setColorScheme()')
  currentWindow.happyDOM.settings.device.prefersColorScheme = scheme
  currentWindow.dispatchEvent(new currentWindow.Event('resize'))
}

export async function runScript(load: () => Promise<unknown>): Promise<void> {
  vi.resetModules()
  await load()
}
