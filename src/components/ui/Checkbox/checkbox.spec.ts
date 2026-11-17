// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import Checkbox from './Checkbox.astro'
import CheckboxGroup from './CheckboxGroup.astro'

describe('Checkbox', () => {
  it('wraps a native checkbox and its text in a <label>', async () => {
    const host = await render(Checkbox, { props: { name: 'terms', label: 'Accept terms' } })
    const label = host.querySelector('label.checkbox')
    const input = label?.querySelector('input')

    expect(input?.getAttribute('type')).toBe('checkbox')
    expect(input?.getAttribute('name')).toBe('terms')
    expect(label?.querySelector('.checkbox-label')?.textContent).toBe('Accept terms')
  })

  it('derives the id from name and value', async () => {
    const withValue = await render(Checkbox, { props: { name: 'tag', value: 'news' } })
    const withoutValue = await render(Checkbox, { props: { name: 'tag' } })

    expect(withValue.querySelector('input')?.id).toBe('tag-news')
    expect(withoutValue.querySelector('input')?.id).toBe('tag-check')
  })

  it('keeps an explicit id', async () => {
    const host = await render(Checkbox, { props: { name: 'tag', id: 'custom' } })
    expect(host.querySelector('input')?.id).toBe('custom')
  })

  it('reflects checked and disabled on the native input', async () => {
    const host = await render(Checkbox, { props: { checked: true, disabled: true } })
    const input = host.querySelector('input')

    expect(input?.hasAttribute('checked')).toBe(true)
    expect(input?.hasAttribute('disabled')).toBe(true)
    expect(host.querySelector('label')?.classList.contains('checkbox-disabled')).toBe(true)
  })

  it('marks indeterminate state with a data attribute, not aria-checked', async () => {
    const host = await render(Checkbox, { props: { indeterminate: true } })
    const input = host.querySelector('input')

    expect(input?.getAttribute('data-indeterminate')).toBe('true')
    expect(input?.hasAttribute('aria-checked')).toBe(false)
  })

  it('uses ariaLabel as the accessible name when there is no visible label', async () => {
    const host = await render(Checkbox, { props: { ariaLabel: 'Select row' } })

    expect(host.querySelector('input')?.getAttribute('aria-label')).toBe('Select row')
    expect(host.querySelector('.checkbox-label')).toBeNull()
  })

  it.each(['primary', 'accent', 'success', 'warning', 'destructive'])(
    'applies the checkbox-%s color',
    async (color) => {
      const host = await render(Checkbox, { props: { color } })
      expect(host.querySelector('label')?.classList.contains(`checkbox-${color}`)).toBe(true)
    },
  )
})

describe('CheckboxGroup', () => {
  it('renders a fieldset with a legend around its items', async () => {
    const host = await render(CheckboxGroup, {
      props: { label: 'Notifications' },
      slots: { default: '<span class="item">Email</span>' },
    })
    const fieldset = host.querySelector('fieldset.checkbox-group')

    expect(fieldset?.querySelector('legend')?.textContent).toBe('Notifications')
    expect(fieldset?.querySelector('.checkbox-group-items .item')?.textContent).toBe('Email')
  })

  it('omits the legend without a label', async () => {
    const host = await render(CheckboxGroup)
    expect(host.querySelector('legend')).toBeNull()
  })
})
