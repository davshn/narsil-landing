// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import Progress from './Progress.astro'

describe('Progress', () => {
  it('exposes progressbar semantics with its value range', async () => {
    const host = await render(Progress, { props: { value: 30, max: 60 } })
    const bar = host.querySelector('[role="progressbar"]')

    expect(bar?.getAttribute('aria-valuenow')).toBe('30')
    expect(bar?.getAttribute('aria-valuemin')).toBe('0')
    expect(bar?.getAttribute('aria-valuemax')).toBe('60')
    expect(bar?.getAttribute('aria-label')).toBe('Progress: 50%')
  })

  it('uses a custom label when given', async () => {
    const host = await render(Progress, { props: { value: 10, label: 'Upload' } })
    expect(host.querySelector('[role="progressbar"]')?.getAttribute('aria-label')).toBe('Upload')
  })

  it('sets the fill width as a percentage of max', async () => {
    const host = await render(Progress, { props: { value: 25, max: 50 } })
    expect(host.querySelector('.progress-fill')?.getAttribute('style')).toContain('width: 50%')
  })

  it('clamps the fill between 0% and 100%', async () => {
    const over = await render(Progress, { props: { value: 150 } })
    const under = await render(Progress, { props: { value: -20 } })

    expect(over.querySelector('.progress-fill')?.getAttribute('style')).toContain('width: 100%')
    expect(under.querySelector('.progress-fill')?.getAttribute('style')).toContain('width: 0%')
  })

  it('uses height for vertical orientation', async () => {
    const host = await render(Progress, { props: { value: 40, orientation: 'vertical' } })

    expect(host.querySelector('.progress')?.classList.contains('progress-vertical')).toBe(true)
    expect(host.querySelector('.progress-fill')?.getAttribute('style')).toContain('height: 40%')
  })

  it('shows the rounded value only when showValue is set', async () => {
    const shown = await render(Progress, { props: { value: 33.4, showValue: true } })
    const hidden = await render(Progress, { props: { value: 33.4 } })

    expect(shown.querySelector('.progress-label')?.textContent).toBe('33%')
    expect(hidden.querySelector('.progress-label')).toBeNull()
  })

  it('applies color, size and rtl classes', async () => {
    const host = await render(Progress, {
      props: { color: 'success', size: 'lg', direction: 'rtl' },
    })
    const classes = [...(host.querySelector('.progress')?.classList ?? [])]

    expect(classes).toEqual(
      expect.arrayContaining(['progress-success', 'progress-lg', 'progress-rtl']),
    )
  })
})
