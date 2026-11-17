// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

import { mountDom, runScript } from '../../../test-dom'
import { render } from '../../../test-render'

import Select from './Select.astro'

const options = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français', disabled: true },
  { value: 'de', label: 'Deutsch' },
]

interface Mounted {
  wrapper: HTMLElement
  trigger: HTMLButtonElement
  dropdown: HTMLElement
  option: (value: string) => HTMLElement
  focused: () => string | undefined
  submitted: () => string[]
  press: (key: string) => void
}

async function loadScript(): Promise<void> {
  await runScript(async () => await import('./custom-select'))
}

function required<T>(element: T | null, what: string): T {
  if (element === null) throw new Error(`${what} not rendered`)
  return element
}

async function mountSelect(props: Record<string, unknown>): Promise<Mounted> {
  const host = await render(Select, { props: { options, ...props } })
  mountDom(host.innerHTML)
  await loadScript()

  const wrapper = required(document.querySelector<HTMLElement>('[data-select-custom]'), 'wrapper')
  const trigger = required(wrapper.querySelector<HTMLButtonElement>('.select-trigger'), 'trigger')

  return {
    wrapper,
    trigger,
    dropdown: required(wrapper.querySelector<HTMLElement>('.select-dropdown'), 'dropdown'),
    option: (value) =>
      required(wrapper.querySelector<HTMLElement>(`[data-value="${value}"]`), `option ${value}`),
    focused: () =>
      Array.from(wrapper.querySelectorAll<HTMLElement>('.select-option-focused')).find(
        (el) => el.style.display !== 'none',
      )?.dataset.value,
    submitted: () =>
      Array.from(wrapper.querySelectorAll<HTMLInputElement>('input[type=hidden]')).map(
        (input) => `${input.name}=${input.value}`,
      ),
    press: (key) => {
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
    },
  }
}

function tagValues(select: Mounted): Array<string | null> {
  return Array.from(select.trigger.querySelectorAll('.select-tag')).map((tag) =>
    tag.getAttribute('data-tag-value'),
  )
}

function isOpen(select: Mounted): boolean {
  return !select.dropdown.classList.contains('select-hidden')
}

describe('custom-select', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('multiple', () => {
    it('opens on trigger click and focuses the first option', async () => {
      const select = await mountSelect({ name: 'tags', multiple: true })

      select.trigger.click()

      expect(isOpen(select)).toBe(true)
      expect(select.trigger.getAttribute('aria-expanded')).toBe('true')
      expect(select.wrapper.classList.contains('select-open')).toBe(true)
      expect(select.focused()).toBe('en')
    })

    it('closes on a second trigger click', async () => {
      const select = await mountSelect({ name: 'tags', multiple: true })

      select.trigger.click()
      select.trigger.click()

      expect(isOpen(select)).toBe(false)
      expect(select.trigger.getAttribute('aria-expanded')).toBe('false')
      expect(select.focused()).toBeUndefined()
    })

    it('adds clicked options as tags and hidden inputs while staying open', async () => {
      const select = await mountSelect({ name: 'tags', multiple: true })

      select.trigger.click()
      select.option('es').click()
      select.option('de').click()

      expect(select.submitted()).toEqual(['tags[]=es', 'tags[]=de'])
      expect(select.option('es').getAttribute('aria-selected')).toBe('true')
      expect(select.option('es').querySelector('.select-option-check')?.classList).not.toContain(
        'invisible',
      )
      expect(tagValues(select)).toEqual(['es', 'de'])
      expect(isOpen(select)).toBe(true)
    })

    it('deselects an already selected option and shows the placeholder again', async () => {
      const select = await mountSelect({
        name: 'tags',
        multiple: true,
        value: ['en'],
        placeholder: 'Pick languages',
      })

      select.option('en').click()

      expect(select.submitted()).toEqual([])
      expect(select.option('en').getAttribute('aria-selected')).toBe('false')
      expect(select.trigger.querySelector('.select-trigger-placeholder')?.textContent).toBe(
        'Pick languages',
      )
    })

    it('removes a value when its tag remove control is clicked', async () => {
      const select = await mountSelect({ name: 'tags', multiple: true, value: ['en', 'es'] })

      select.trigger.querySelector<HTMLElement>('[data-remove-value="en"]')?.click()

      expect(select.submitted()).toEqual(['tags[]=es'])
    })

    it('ignores clicks on disabled options', async () => {
      const select = await mountSelect({ name: 'tags', multiple: true })

      select.option('fr').click()

      expect(select.submitted()).toEqual([])
    })

    it('closes when clicking outside the select', async () => {
      const select = await mountSelect({ name: 'tags', multiple: true })

      select.trigger.click()
      document.body.click()

      expect(isOpen(select)).toBe(false)
    })

    it('keeps the label as the raw value when options metadata is invalid', async () => {
      const select = await mountSelect({ name: 'tags', multiple: true })
      select.wrapper.dataset.selectOptions = '[1, 2]'

      select.option('es').click()

      expect(select.trigger.querySelector('.select-tag')?.textContent).toContain('es')
      expect(select.trigger.querySelector('.select-tag')?.textContent).not.toContain('Español')
    })
  })

  describe('keyboard', () => {
    it.each(['ArrowDown', 'Enter', ' '])('opens with %j while closed', async (key) => {
      const select = await mountSelect({ name: 'tags', multiple: true })

      select.press(key)

      expect(isOpen(select)).toBe(true)
    })

    it('ignores other keys while closed', async () => {
      const select = await mountSelect({ name: 'tags', multiple: true })

      select.press('a')

      expect(isOpen(select)).toBe(false)
    })

    it('moves focus with arrows, skipping disabled options and wrapping around', async () => {
      const select = await mountSelect({ name: 'tags', multiple: true })
      select.trigger.click()

      select.press('ArrowDown')
      expect(select.focused()).toBe('es')
      select.press('ArrowDown')
      expect(select.focused()).toBe('de')
      select.press('ArrowDown')
      expect(select.focused()).toBe('en')
      select.press('ArrowUp')
      expect(select.focused()).toBe('de')
      select.press('ArrowUp')
      expect(select.focused()).toBe('es')
    })

    it('jumps to the first and last options with Home and End', async () => {
      const select = await mountSelect({ name: 'tags', multiple: true })
      select.trigger.click()

      select.press('End')
      expect(select.focused()).toBe('de')
      select.press('Home')
      expect(select.focused()).toBe('en')
    })

    it('toggles the focused option with Enter and Space without closing', async () => {
      const select = await mountSelect({ name: 'tags', multiple: true })
      select.trigger.click()

      select.press('Enter')
      select.press('ArrowDown')
      select.press(' ')
      select.press('ArrowUp')
      select.press('Enter')

      expect(select.submitted()).toEqual(['tags[]=es'])
      expect(isOpen(select)).toBe(true)
    })

    it('closes with Escape and returns focus to the trigger', async () => {
      const select = await mountSelect({ name: 'tags', multiple: true })
      select.trigger.click()

      select.press('Escape')

      expect(isOpen(select)).toBe(false)
      expect(document.activeElement).toBe(select.trigger)
    })

    it('leaves the state alone for unhandled keys while open', async () => {
      const select = await mountSelect({ name: 'tags', multiple: true })
      select.trigger.click()

      select.press('Tab')

      expect(isOpen(select)).toBe(true)
      expect(select.focused()).toBe('en')
    })
  })

  describe('single searchable', () => {
    it('focuses an empty search box when opened', async () => {
      const select = await mountSelect({ name: 'lang', searchable: true })
      const search = required(
        select.wrapper.querySelector<HTMLInputElement>('.select-search'),
        'search',
      )
      search.value = 'stale'

      select.trigger.click()

      expect(search.value).toBe('')
      expect(document.activeElement).toBe(search)
      expect(select.focused()).toBe('en')
    })

    it('filters options by label and shows a no-results message', async () => {
      const select = await mountSelect({
        name: 'lang',
        searchable: true,
        noResultsText: 'Nothing here',
      })
      const search = required(
        select.wrapper.querySelector<HTMLInputElement>('.select-search'),
        'search',
      )
      select.trigger.click()

      search.value = 'DEUT'
      search.dispatchEvent(new Event('input'))
      expect(select.option('de').style.display).toBe('')
      expect(select.option('en').style.display).toBe('none')
      expect(select.focused()).toBe('de')

      search.value = 'zzz'
      search.dispatchEvent(new Event('input'))
      expect(select.dropdown.querySelector('.select-empty')?.textContent).toBe('Nothing here')

      search.value = ''
      search.dispatchEvent(new Event('input'))
      expect(select.dropdown.querySelector('.select-empty')).toBeNull()
    })

    it('replaces the value and closes when an option is clicked', async () => {
      const select = await mountSelect({ name: 'lang', searchable: true, value: 'en' })
      select.trigger.click()

      select.option('de').click()

      expect(select.submitted()).toEqual(['lang=de'])
      expect(select.trigger.textContent).toBe('Deutsch')
      expect(isOpen(select)).toBe(false)
    })

    it('selects the focused option with Enter and closes', async () => {
      const select = await mountSelect({ name: 'lang', searchable: true })
      select.trigger.click()

      select.press('ArrowDown')
      select.press('Enter')

      expect(select.submitted()).toEqual(['lang=es'])
      expect(isOpen(select)).toBe(false)
    })

    it('does nothing on Enter when no option is focused', async () => {
      const select = await mountSelect({ name: 'lang', searchable: true })
      const search = required(
        select.wrapper.querySelector<HTMLInputElement>('.select-search'),
        'search',
      )
      select.trigger.click()
      search.value = 'zzz'
      search.dispatchEvent(new Event('input'))

      select.press('Enter')

      expect(select.submitted()).toEqual([])
      expect(isOpen(select)).toBe(true)
    })
  })

  describe('markup in option data', () => {
    const htmlOptions = [
      { value: 'a"><img src=x id=value-img>', label: '<img src=x id=label-img>' },
      { value: 'b', label: 'Plain' },
    ]

    const firstOption = (select: Mounted): HTMLElement =>
      required(select.wrapper.querySelector<HTMLElement>('.select-option'), 'first option')

    it('renders a multiple-select tag label and value as text', async () => {
      const select = await mountSelect({ name: 'tags', multiple: true, options: htmlOptions })

      firstOption(select).click()

      const tag = required(select.trigger.querySelector('.select-tag'), 'tag')
      expect(select.trigger.querySelector('img')).toBeNull()
      expect(tag.textContent).toContain('<img src=x id=label-img>')
      expect(tag.getAttribute('data-tag-value')).toBe(htmlOptions[0].value)
      expect(tag.querySelector('.select-tag-remove')?.getAttribute('data-remove-value')).toBe(
        htmlOptions[0].value,
      )
    })

    it('renders a single-select label as text', async () => {
      const select = await mountSelect({ name: 'lang', searchable: true, options: htmlOptions })
      select.trigger.click()

      firstOption(select).click()

      expect(select.trigger.querySelector('img')).toBeNull()
      expect(select.trigger.textContent).toBe('<img src=x id=label-img>')
    })

    it('renders the placeholder as text', async () => {
      const select = await mountSelect({
        name: 'tags',
        multiple: true,
        options: htmlOptions,
        value: ['b'],
        placeholder: '<b id=ph>Pick</b>',
      })

      select.option('b').click()

      expect(select.trigger.querySelector('#ph')).toBeNull()
      expect(select.trigger.querySelector('.select-trigger-placeholder')?.textContent).toBe(
        '<b id=ph>Pick</b>',
      )
    })
  })

  it('skips wrappers without a trigger or dropdown', async () => {
    mountDom('<div data-select-custom></div>')

    await expect(loadScript()).resolves.toBeUndefined()
  })
})
