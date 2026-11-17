// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import Radio from './Radio.astro'
import RadioGroup from './RadioGroup.astro'

describe('Radio', () => {
  it('wraps a native radio and its text in a <label>', async () => {
    const host = await render(Radio, { props: { name: 'plan', value: 'pro', label: 'Pro' } })
    const label = host.querySelector('label.radio')
    const input = label?.querySelector('input')

    expect(input?.getAttribute('type')).toBe('radio')
    expect(input?.getAttribute('name')).toBe('plan')
    expect(input?.getAttribute('value')).toBe('pro')
    expect(input?.id).toBe('plan-pro')
    expect(label?.querySelector('.radio-label')?.textContent).toBe('Pro')
  })

  it('reflects checked and disabled on the native input', async () => {
    const host = await render(Radio, {
      props: { name: 'plan', value: 'pro', checked: true, disabled: true },
    })
    const input = host.querySelector('input')

    expect(input?.hasAttribute('checked')).toBe(true)
    expect(input?.hasAttribute('disabled')).toBe(true)
    expect(host.querySelector('label')?.classList.contains('radio-disabled')).toBe(true)
  })

  it('uses ariaLabel as the accessible name when there is no visible label', async () => {
    const host = await render(Radio, { props: { name: 'plan', value: 'a', ariaLabel: 'Plan A' } })

    expect(host.querySelector('input')?.getAttribute('aria-label')).toBe('Plan A')
    expect(host.querySelector('.radio-label')).toBeNull()
  })

  it.each(['primary', 'accent', 'success', 'warning', 'destructive'])(
    'applies the radio-%s color',
    async (color) => {
      const host = await render(Radio, { props: { name: 'c', value: 'v', color } })
      expect(host.querySelector('label')?.classList.contains(`radio-${color}`)).toBe(true)
    },
  )
})

describe('RadioGroup', () => {
  it('renders a vertical fieldset with a legend by default', async () => {
    const host = await render(RadioGroup, {
      props: { label: 'Plan' },
      slots: { default: '<span class="item">Free</span>' },
    })
    const fieldset = host.querySelector('fieldset.radio-group')

    expect(fieldset?.querySelector('legend')?.textContent).toBe('Plan')
    expect(fieldset?.classList.contains('radio-group-horizontal')).toBe(false)
    expect(fieldset?.querySelector('.radio-group-items .item')?.textContent).toBe('Free')
  })

  it('lays items out horizontally when requested', async () => {
    const host = await render(RadioGroup, { props: { direction: 'horizontal' } })
    expect(host.querySelector('fieldset')?.classList.contains('radio-group-horizontal')).toBe(true)
  })
})
