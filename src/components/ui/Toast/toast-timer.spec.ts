// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { mountDom, runScript } from '../../../test-dom'
import { render } from '../../../test-render'

import Toast from './Toast.astro'

async function mountToasts(propsList: Array<Record<string, unknown>>): Promise<HTMLElement[]> {
  const hosts = await Promise.all(
    propsList.map(async (props) => await render(Toast, { props: { title: 'Saved', ...props } })),
  )
  mountDom(hosts.map((host) => host.innerHTML).join(''))
  await runScript(async () => await import('./toast-timer'))
  return [...document.querySelectorAll<HTMLElement>('[data-toast]')]
}

function isClosing(toast: HTMLElement): boolean {
  return toast.classList.contains('toast-closing')
}

function playState(toast: HTMLElement): string | undefined {
  return toast.querySelector<HTMLElement>('.toast-progress-bar')?.style.animationPlayState
}

describe('toast-timer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('starts closing after its duration and removes itself when the animation ends', async () => {
    const [toast] = await mountToasts([{ duration: 3000 }])

    vi.advanceTimersByTime(2999)
    expect(isClosing(toast)).toBe(false)
    vi.advanceTimersByTime(1)
    expect(isClosing(toast)).toBe(true)

    toast.dispatchEvent(new Event('animationend'))
    expect(document.querySelector('[data-toast]')).toBeNull()
  })

  it('closes on dismiss and cancels its pending timer', async () => {
    const [toast] = await mountToasts([{}])

    toast.querySelector<HTMLButtonElement>('[data-toast-dismiss]')?.click()

    expect(isClosing(toast)).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
    toast.dispatchEvent(new Event('animationend'))
    expect(document.querySelector('[data-toast]')).toBeNull()
  })

  it('pauses the timer and the progress bar while hovered', async () => {
    const [toast] = await mountToasts([{ duration: 5000 }])

    vi.advanceTimersByTime(2000)
    toast.dispatchEvent(new Event('mouseenter'))

    expect(playState(toast)).toBe('paused')
    vi.advanceTimersByTime(60_000)
    expect(isClosing(toast)).toBe(false)
  })

  it('resumes with the remaining time when the pointer leaves', async () => {
    const [toast] = await mountToasts([{ duration: 5000 }])

    vi.advanceTimersByTime(2000)
    toast.dispatchEvent(new Event('mouseenter'))
    vi.advanceTimersByTime(10_000)
    toast.dispatchEvent(new Event('mouseleave'))

    expect(playState(toast)).toBe('running')
    vi.advanceTimersByTime(2999)
    expect(isClosing(toast)).toBe(false)
    vi.advanceTimersByTime(1)
    expect(isClosing(toast)).toBe(true)
  })

  it('keeps the remaining time across several hovers', async () => {
    const [toast] = await mountToasts([{ duration: 5000 }])

    vi.advanceTimersByTime(1000)
    toast.dispatchEvent(new Event('mouseenter'))
    vi.advanceTimersByTime(5000)
    toast.dispatchEvent(new Event('mouseleave'))
    vi.advanceTimersByTime(1000)
    toast.dispatchEvent(new Event('mouseenter'))
    vi.advanceTimersByTime(5000)
    toast.dispatchEvent(new Event('mouseleave'))

    vi.advanceTimersByTime(2999)
    expect(isClosing(toast)).toBe(false)
    vi.advanceTimersByTime(1)
    expect(isClosing(toast)).toBe(true)
  })

  it('waits at least 500ms after the pointer leaves', async () => {
    const [toast] = await mountToasts([{ duration: 5000 }])

    vi.advanceTimersByTime(4900)
    toast.dispatchEvent(new Event('mouseenter'))
    toast.dispatchEvent(new Event('mouseleave'))

    vi.advanceTimersByTime(499)
    expect(isClosing(toast)).toBe(false)
    vi.advanceTimersByTime(1)
    expect(isClosing(toast)).toBe(true)
  })

  it('never closes on its own with a zero duration, even after a hover', async () => {
    const [toast] = await mountToasts([{ duration: 0 }])

    toast.dispatchEvent(new Event('mouseenter'))
    toast.dispatchEvent(new Event('mouseleave'))
    vi.advanceTimersByTime(60_000)

    expect(isClosing(toast)).toBe(false)
    expect(playState(toast)).toBe('running')
  })

  it('handles each toast once when several share the page', async () => {
    const toasts = await mountToasts([{ duration: 5000 }, { duration: 5000 }])
    const removeSpy = vi.spyOn(toasts[0], 'remove')

    toasts[0].querySelector<HTMLButtonElement>('[data-toast-dismiss]')?.click()
    toasts[0].dispatchEvent(new Event('animationend'))

    expect(removeSpy).toHaveBeenCalledTimes(1)
    expect(isClosing(toasts[1])).toBe(false)
    expect(vi.getTimerCount()).toBe(1)
  })
})
