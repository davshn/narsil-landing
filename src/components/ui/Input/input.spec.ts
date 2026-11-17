// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import Input from './Input.astro'

describe('Input', () => {
  it('renders an outlined md text input by default', async () => {
    const host = await render(Input, { props: { name: 'email' } })
    const input = host.querySelector('input.input-field')
    const wrapper = host.querySelector('.input-wrapper')

    expect(input?.getAttribute('type')).toBe('text')
    expect(input?.id).toBe('email')
    expect(wrapper?.classList.contains('input-outlined')).toBe(true)
    expect(wrapper?.classList.contains('input-md')).toBe(true)
  })

  it('associates the label with the input and marks required fields', async () => {
    const host = await render(Input, {
      props: { name: 'email', label: 'Email', required: true },
    })
    const label = host.querySelector('label.input-label')

    expect(label?.getAttribute('for')).toBe('email')
    expect(label?.textContent).toContain('Email')
    expect(label?.querySelector('[aria-hidden="true"]')?.textContent.trim()).toBe('*')
    expect(host.querySelector('input')?.hasAttribute('required')).toBe(true)
  })

  it('describes the input with its hint', async () => {
    const host = await render(Input, { props: { name: 'user', hint: 'Lowercase only' } })

    expect(host.querySelector('input')?.getAttribute('aria-describedby')).toBe('user-hint')
    expect(host.querySelector('#user-hint')?.textContent.trim()).toBe('Lowercase only')
  })

  it('shows the error instead of the hint and marks the input invalid', async () => {
    const host = await render(Input, {
      props: { name: 'user', hint: 'Lowercase only', error: 'Taken' },
    })
    const input = host.querySelector('input')

    expect(input?.getAttribute('aria-invalid')).toBe('true')
    expect(input?.getAttribute('aria-describedby')).toBe('user-error')
    expect(host.querySelector('#user-error[role="alert"]')?.textContent.trim()).toBe('Taken')
    expect(host.querySelector('.input-hint')).toBeNull()
    expect(host.querySelector('.input-wrapper')?.classList.contains('input-error')).toBe(true)
  })

  it('renders decorative left and right icons', async () => {
    const host = await render(Input, {
      props: { name: 'q', iconLeft: 'lucide:search', iconRight: 'lucide:dollar-sign' },
    })
    const wrapper = host.querySelector('.input-wrapper')

    expect(host.querySelector('.input-icon-left')?.getAttribute('aria-hidden')).toBe('true')
    expect(host.querySelector('.input-icon-right')?.getAttribute('aria-hidden')).toBe('true')
    expect(wrapper?.classList.contains('input-has-icon-left')).toBe(true)
    expect(wrapper?.classList.contains('input-has-icon-right')).toBe(true)
  })

  it('adds a labelled visibility toggle to password inputs', async () => {
    const host = await render(Input, {
      props: { name: 'pw', type: 'password', passwordToggleLabel: 'Mostrar contraseña' },
    })
    const toggle = host.querySelector('button.input-password-toggle')

    expect(host.querySelector('input')?.getAttribute('type')).toBe('password')
    expect(toggle?.getAttribute('type')).toBe('button')
    expect(toggle?.getAttribute('aria-label')).toBe('Mostrar contraseña')
    expect(toggle?.getAttribute('data-password-toggle')).toBe('pw')
  })

  it('disables the native input', async () => {
    const host = await render(Input, { props: { name: 'x', disabled: true } })

    expect(host.querySelector('input')?.hasAttribute('disabled')).toBe(true)
    expect(host.querySelector('.input-wrapper')?.classList.contains('input-disabled')).toBe(true)
  })
})
