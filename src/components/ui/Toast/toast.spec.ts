// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import Toast from './Toast.astro'

describe('Toast', () => {
  it('renders an info toast announced as an alert', async () => {
    const host = await render(Toast, {
      props: { title: 'Saved' },
      slots: { default: 'Your changes are live.' },
    })
    const toast = host.querySelector('.toast')

    expect(toast?.classList.contains('toast-info')).toBe(true)
    expect(toast?.getAttribute('role')).toBe('alert')
    expect(host.querySelector('.toast-title')?.textContent).toBe('Saved')
    expect(host.querySelector('.toast-content')?.textContent).toContain('Your changes are live.')
  })

  it('uses a 5s default duration for both the timer and the progress bar', async () => {
    const host = await render(Toast, { props: { title: 'T' } })

    expect(host.querySelector('.toast')?.getAttribute('data-toast-duration')).toBe('5000')
    expect(host.querySelector('.toast-progress-bar')?.getAttribute('style')).toContain(
      'animation-duration: 5000ms',
    )
  })

  it('applies a custom duration and variant', async () => {
    const host = await render(Toast, { props: { title: 'T', variant: 'error', duration: 2000 } })
    const toast = host.querySelector('.toast')

    expect(toast?.classList.contains('toast-error')).toBe(true)
    expect(toast?.getAttribute('data-toast-duration')).toBe('2000')
  })

  it('has a decorative icon, a labelled dismiss button and an actions slot', async () => {
    const host = await render(Toast, {
      props: { title: 'T' },
      slots: { actions: '<button>Undo</button>' },
    })
    const dismiss = host.querySelector('button.toast-dismiss')

    expect(host.querySelector('svg.toast-icon')?.getAttribute('aria-hidden')).toBe('true')
    expect(dismiss?.getAttribute('aria-label')).toBe('Dismiss')
    expect(dismiss?.getAttribute('type')).toBe('button')
    expect(host.querySelector('.toast-footer button')?.textContent).toBe('Undo')
  })
})
