// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import Button from './Button.astro'

const scriptHref = ['javascript', 'alert(1)'].join(':')

describe('Button', () => {
  it('renders a button instead of a link for an unsafe href', async () => {
    const host = await render(Button, { props: { href: scriptHref }, slots: { default: 'Go' } })

    expect(host.querySelector('a')).toBeNull()
    expect(host.querySelector('button')?.textContent).toContain('Go')
  })

  it('keeps a safe relative href', async () => {
    const host = await render(Button, { props: { href: '/en/#pricing' }, slots: { default: 'Go' } })

    expect(host.querySelector('a')?.getAttribute('href')).toBe('/en/#pricing')
  })

  it('renders a primary md <button type="button"> by default', async () => {
    const host = await render(Button, { slots: { default: 'Save' } })
    const button = host.querySelector('button')

    expect(button?.className).toContain('btn-primary')
    expect(button?.className).toContain('btn-md')
    expect(button?.getAttribute('type')).toBe('button')
    expect(button?.textContent).toContain('Save')
  })

  it.each(['primary', 'secondary', 'ghost', 'icon', 'outline', 'destructive'])(
    'applies the btn-%s variant class',
    async (variant) => {
      const host = await render(Button, { props: { variant } })
      expect(host.querySelector('button')?.classList.contains(`btn-${variant}`)).toBe(true)
    },
  )

  it.each(['sm', 'md', 'lg'])('applies the btn-%s size class', async (size) => {
    const host = await render(Button, { props: { size } })
    expect(host.querySelector('button')?.classList.contains(`btn-${size}`)).toBe(true)
  })

  it('renders an <a> with href when href is given', async () => {
    const host = await render(Button, { props: { href: '/pricing' }, slots: { default: 'Go' } })
    const link = host.querySelector('a')

    expect(link?.getAttribute('href')).toBe('/pricing')
    expect(host.querySelector('button')).toBeNull()
  })

  it('disables a <button> natively', async () => {
    const host = await render(Button, { props: { disabled: true } })
    const button = host.querySelector('button')

    expect(button?.hasAttribute('disabled')).toBe(true)
    expect(button?.classList.contains('btn-disabled')).toBe(true)
  })

  it('disables a link with aria-disabled and removes it from the tab order', async () => {
    const host = await render(Button, { props: { href: '/x', disabled: true } })
    const link = host.querySelector('a')

    expect(link?.getAttribute('aria-disabled')).toBe('true')
    expect(link?.getAttribute('tabindex')).toBe('-1')
  })

  it('marks the button busy and shows a spinner while loading', async () => {
    const host = await render(Button, { props: { loading: true }, slots: { default: 'Save' } })
    const button = host.querySelector('button')

    expect(button?.getAttribute('aria-busy')).toBe('true')
    expect(button?.hasAttribute('disabled')).toBe(true)
    expect(host.querySelector('.btn-spinner')?.getAttribute('aria-hidden')).toBe('true')
    expect(host.querySelector('.btn-content-hidden')?.textContent).toContain('Save')
  })

  it('lets a form button override the default type', async () => {
    const host = await render(Button, { props: { type: 'submit' } })
    expect(host.querySelector('button')?.getAttribute('type')).toBe('submit')
  })

  it('passes through extra attributes and classes', async () => {
    const host = await render(Button, {
      props: { 'aria-label': 'Close', class: 'extra', id: 'close-btn' },
    })
    const button = host.querySelector('button')

    expect(button?.getAttribute('aria-label')).toBe('Close')
    expect(button?.id).toBe('close-btn')
    expect(button?.classList.contains('extra')).toBe(true)
  })
})
