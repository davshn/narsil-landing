// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import Select from './Select.astro'

const options = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français', disabled: true },
]

describe('Select (native)', () => {
  it('renders a native <select> with one option per item and the selected value', async () => {
    const host = await render(Select, { props: { name: 'lang', options, value: 'es' } })
    const select = host.querySelector('select.select-field')
    const optionEls = [...(select?.querySelectorAll('option') ?? [])]

    expect(select?.id).toBe('lang')
    expect(optionEls.map((o) => o.textContent.trim())).toEqual(['English', 'Español', 'Français'])
    expect(optionEls[1]?.hasAttribute('selected')).toBe(true)
    expect(optionEls[2]?.hasAttribute('disabled')).toBe(true)
  })

  it('adds a disabled placeholder option selected when there is no value', async () => {
    const host = await render(Select, { props: { options, placeholder: 'Pick one' } })
    const first = host.querySelector('option')

    expect(first?.getAttribute('value')).toBe('')
    expect(first?.textContent.trim()).toBe('Pick one')
    expect(first?.hasAttribute('disabled')).toBe(true)
    expect(first?.hasAttribute('selected')).toBe(true)
  })

  it('associates label, hint and error with the field', async () => {
    const withHint = await render(Select, {
      props: { name: 'lang', options, label: 'Language', hint: 'Site language' },
    })
    const withError = await render(Select, {
      props: { name: 'lang', options, hint: 'Site language', error: 'Required' },
    })

    expect(withHint.querySelector('label')?.getAttribute('for')).toBe('lang')
    expect(withHint.querySelector('select')?.getAttribute('aria-describedby')).toBe('lang-hint')
    expect(withError.querySelector('select')?.getAttribute('aria-invalid')).toBe('true')
    expect(withError.querySelector('select')?.getAttribute('aria-describedby')).toBe('lang-error')
    expect(withError.querySelector('#lang-error')?.textContent.trim()).toBe('Required')
    expect(withError.querySelector('.select-hint')).toBeNull()
  })
})

describe('Select (custom)', () => {
  it('renders a combobox and listbox instead of a native select when multiple', async () => {
    const host = await render(Select, {
      props: { name: 'tags', options, multiple: true, value: ['en', 'es'] },
    })
    const combobox = host.querySelector('[role="combobox"]')
    const listbox = host.querySelector('[role="listbox"]')

    expect(host.querySelector('select')).toBeNull()
    expect(combobox?.getAttribute('aria-expanded')).toBe('false')
    expect(combobox?.getAttribute('aria-haspopup')).toBe('listbox')
    expect(combobox?.getAttribute('aria-controls')).toBe(listbox?.id)
    expect(listbox?.getAttribute('aria-multiselectable')).toBe('true')
  })

  it('marks selected and disabled options and renders removable tags', async () => {
    const host = await render(Select, {
      props: { name: 'tags', options, multiple: true, value: ['es'] },
    })
    const optionEls = [...host.querySelectorAll('[role="option"]')]

    expect(optionEls.map((o) => o.getAttribute('aria-selected'))).toEqual([
      'false',
      'true',
      'false',
    ])
    expect(optionEls[2]?.getAttribute('aria-disabled')).toBe('true')
    expect(host.querySelector('[data-remove-value="es"]')?.getAttribute('aria-label')).toBe(
      'Remove Español',
    )
  })

  it('adds a labelled search box when searchable', async () => {
    const host = await render(Select, {
      props: { name: 'lang', options, searchable: true, searchPlaceholder: 'Buscar' },
    })

    expect(host.querySelector('input.select-search')?.getAttribute('aria-label')).toBe('Buscar')
    expect(host.querySelector('[role="listbox"]')?.hasAttribute('aria-multiselectable')).toBe(false)
  })
})
