// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

import { mountDom, runScript } from '../test-dom'

const PAGE = `
  <select name="locale">
    <option value="en">English</option>
    <option value="es">Español</option>
  </select>
  <nav>
    <a class="sidebar-action" href="#button" data-active="false">Button</a>
    <a class="sidebar-action" href="#input" data-active="false">Input</a>
  </nav>
  <section class="component-panel" data-panel="button">Button panel</section>
  <section class="component-panel" data-panel="input">Input panel</section>
`

function visiblePanels(): Array<string | undefined> {
  return Array.from(document.querySelectorAll<HTMLElement>('.component-panel'))
    .filter((panel) => panel.style.display === 'block')
    .map((panel) => panel.dataset.panel)
}

function activeLinks(): Array<string | null> {
  return Array.from(document.querySelectorAll('.sidebar-action[data-active="true"]')).map((link) =>
    link.getAttribute('href'),
  )
}

async function mountPage(url = 'http://localhost/en/'): Promise<void> {
  mountDom(PAGE, url)
  await runScript(async () => await import('./showcase-navigation'))
}

describe('showcase-navigation', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the first panel when the URL has no hash', async () => {
    await mountPage()

    expect(visiblePanels()).toEqual(['button'])
    expect(activeLinks()).toEqual(['#button'])
  })

  it('shows the panel named by the initial hash', async () => {
    await mountPage('http://localhost/en/#input')

    expect(visiblePanels()).toEqual(['input'])
    expect(activeLinks()).toEqual(['#input'])
  })

  it('falls back to the first panel when the hash matches no panel', async () => {
    await mountPage('http://localhost/en/#unknown')

    expect(visiblePanels()).toEqual(['button'])
  })

  it('treats a hash that injects a selector list as an unknown panel', async () => {
    await mountPage('http://localhost/en/#x],[data-panel')

    expect(visiblePanels()).toEqual(['button'])
  })

  it('treats a hash with invalid selector syntax as an unknown panel and keeps listening', async () => {
    await mountPage('http://localhost/en/#a(')

    expect(visiblePanels()).toEqual(['button'])

    window.location.hash = '#input'
    window.dispatchEvent(new HashChangeEvent('hashchange'))

    expect(visiblePanels()).toEqual(['input'])
  })

  it('does not fail on a page without component panels', async () => {
    mountDom('<select name="locale"><option value="en">English</option></select>')

    await expect(
      runScript(async () => await import('./showcase-navigation')),
    ).resolves.toBeUndefined()
  })

  it('ignores a locale selector value that is not a supported locale', async () => {
    await mountPage()
    const setHref = vi.spyOn(window.location, 'href', 'set').mockImplementation(() => undefined)
    const select = document.querySelector<HTMLSelectElement>('select[name=locale]')
    if (select === null) throw new Error('locale select not rendered')
    const evil = document.createElement('option')
    evil.value = '/evil.example'
    select.append(evil)

    select.value = '/evil.example'
    select.dispatchEvent(new Event('change'))

    expect(setHref).not.toHaveBeenCalled()
  })

  it('switches panel and updates the hash when a sidebar link is clicked', async () => {
    await mountPage()

    document.querySelector<HTMLAnchorElement>('a[href="#input"]')?.click()

    expect(visiblePanels()).toEqual(['input'])
    expect(activeLinks()).toEqual(['#input'])
    expect(window.location.hash).toBe('#input')
  })

  it('follows hash changes from browser navigation', async () => {
    await mountPage()

    window.location.hash = '#input'
    window.dispatchEvent(new HashChangeEvent('hashchange'))

    expect(visiblePanels()).toEqual(['input'])
  })

  it('redirects to the selected locale when the locale selector changes', async () => {
    await mountPage()
    const setHref = vi.spyOn(window.location, 'href', 'set').mockImplementation(() => undefined)
    const select = document.querySelector<HTMLSelectElement>('select[name=locale]')
    if (select === null) throw new Error('locale select not rendered')

    select.value = 'es'
    select.dispatchEvent(new Event('change'))

    expect(setHref).toHaveBeenCalledWith('/es/')
  })
})
