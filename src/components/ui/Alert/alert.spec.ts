// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import Alert from './Alert.astro'

describe('Alert', () => {
  it('renders an info alert as a polite status by default', async () => {
    const host = await render(Alert, { slots: { default: 'Saved draft' } })
    const alert = host.querySelector('.alert')

    expect(alert?.classList.contains('alert-info')).toBe(true)
    expect(alert?.getAttribute('role')).toBe('status')
    expect(alert?.getAttribute('aria-live')).toBe('polite')
    expect(host.querySelector('.alert-description')?.textContent).toContain('Saved draft')
  })

  it('announces errors assertively with role alert', async () => {
    const host = await render(Alert, { props: { variant: 'error' } })
    const alert = host.querySelector('.alert')

    expect(alert?.getAttribute('role')).toBe('alert')
    expect(alert?.getAttribute('aria-live')).toBe('assertive')
  })

  it.each(['success', 'warning'])('treats %s as a polite status', async (variant) => {
    const host = await render(Alert, { props: { variant } })
    const alert = host.querySelector('.alert')

    expect(alert?.classList.contains(`alert-${variant}`)).toBe(true)
    expect(alert?.getAttribute('role')).toBe('status')
  })

  it('renders the title only when provided', async () => {
    const withTitle = await render(Alert, { props: { title: 'Heads up' } })
    const withoutTitle = await render(Alert)

    expect(withTitle.querySelector('.alert-title')?.textContent).toBe('Heads up')
    expect(withoutTitle.querySelector('.alert-title')).toBeNull()
  })

  it('always shows a decorative icon', async () => {
    const host = await render(Alert)
    expect(host.querySelector('svg.alert-icon')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('adds a labelled dismiss button only when dismissible', async () => {
    const dismissible = await render(Alert, { props: { dismissible: true } })
    const fixed = await render(Alert)
    const button = dismissible.querySelector('button.alert-dismiss')

    expect(button?.getAttribute('type')).toBe('button')
    expect(button?.getAttribute('aria-label')).toBe('Dismiss')
    expect(fixed.querySelector('.alert-dismiss')).toBeNull()
  })

  it('exposes autoClose only for positive durations', async () => {
    const timed = await render(Alert, { props: { autoClose: 3000 } })
    const zero = await render(Alert, { props: { autoClose: 0 } })

    expect(timed.querySelector('.alert')?.getAttribute('data-auto-close')).toBe('3000')
    expect(zero.querySelector('.alert')?.hasAttribute('data-auto-close')).toBe(false)
  })
})
