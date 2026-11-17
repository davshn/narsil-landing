// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

import { mountDom, runScript } from '../../../test-dom'
import { render } from '../../../test-render'

import Carousel from './Carousel.astro'

const slides = '<div>One</div><div>Two</div><div>Three</div>'
const WIDTH = 500

interface CarouselParts {
  root: HTMLElement
  track: HTMLElement
  prev: HTMLButtonElement
  next: HTMLButtonElement
  dots: () => HTMLButtonElement[]
}

function partsOf(root: HTMLElement): CarouselParts {
  const track = root.querySelector<HTMLElement>('[data-carousel-track]')
  const prev = root.querySelector<HTMLButtonElement>('[data-carousel-prev]')
  const next = root.querySelector<HTMLButtonElement>('[data-carousel-next]')
  if (track === null || prev === null || next === null) throw new Error('Carousel parts missing')
  return {
    root,
    track,
    prev,
    next,
    dots: () => [...root.querySelectorAll<HTMLButtonElement>('.carousel-dot')],
  }
}

async function mountCarousels(propsList: Array<Record<string, unknown>>): Promise<CarouselParts[]> {
  const hosts = await Promise.all(
    propsList.map(async (props) => await render(Carousel, { props, slots: { default: slides } })),
  )
  mountDom(hosts.map((host) => host.innerHTML).join(''))
  document.querySelectorAll<HTMLElement>('[data-carousel]').forEach((root) => {
    Object.defineProperty(root, 'offsetWidth', { configurable: true, value: WIDTH })
  })
  await runScript(async () => await import('./carousel-slider'))
  return [...document.querySelectorAll<HTMLElement>('[data-carousel]')].map(partsOf)
}

function activeIndex(carousel: CarouselParts): number {
  return carousel.dots().findIndex((dot) => dot.getAttribute('aria-selected') === 'true')
}

function touchEvent(type: string, clientX: number): Event {
  const event = new window.Event(type)
  Object.defineProperty(event, 'touches', { value: [{ clientX }] })
  return event
}

function mouseDrag(carousel: CarouselParts, from: number, to: number): void {
  carousel.track.dispatchEvent(new window.MouseEvent('mousedown', { clientX: from }))
  document.dispatchEvent(new window.MouseEvent('mousemove', { clientX: to }))
  document.dispatchEvent(new window.MouseEvent('mouseup'))
}

describe('carousel-slider', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('marks every slotted child as a slide and starts on the first one', async () => {
    const [carousel] = await mountCarousels([{}])

    expect(carousel.track.querySelectorAll(':scope > .carousel-slide')).toHaveLength(3)
    expect(carousel.track.style.transform).toBe('translateX(-0%)')
  })

  it('builds one labelled tab dot per slide and marks the active one', async () => {
    const [carousel] = await mountCarousels([{}])
    const dots = carousel.dots()

    expect(dots).toHaveLength(3)
    expect(dots.map((dot) => dot.getAttribute('role'))).toEqual(['tab', 'tab', 'tab'])
    expect(dots.map((dot) => dot.getAttribute('aria-label'))).toEqual([
      'Slide 1',
      'Slide 2',
      'Slide 3',
    ])
    expect(dots.map((dot) => dot.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false'])
    expect(dots.map((dot) => dot.dataset.active)).toEqual(['true', 'false', 'false'])
  })

  it('moves to the slide of a clicked dot', async () => {
    const [carousel] = await mountCarousels([{}])

    carousel.dots()[2].click()

    expect(carousel.track.style.transform).toBe('translateX(-200%)')
    expect(activeIndex(carousel)).toBe(2)
    expect(carousel.dots()[2].dataset.active).toBe('true')
  })

  it('clamps navigation and disables the arrows at the edges without loop', async () => {
    const [carousel] = await mountCarousels([{}])

    expect(carousel.prev.disabled).toBe(true)
    expect(carousel.next.disabled).toBe(false)

    carousel.next.click()
    expect(carousel.track.style.transform).toBe('translateX(-100%)')
    expect(carousel.prev.disabled).toBe(false)

    carousel.next.click()
    expect(carousel.next.disabled).toBe(true)

    carousel.next.click()
    expect(carousel.track.style.transform).toBe('translateX(-200%)')

    carousel.prev.click()
    expect(carousel.track.style.transform).toBe('translateX(-100%)')
  })

  it('wraps around both ends and keeps the arrows enabled with loop', async () => {
    const [carousel] = await mountCarousels([{ loop: true }])

    carousel.prev.click()
    expect(carousel.track.style.transform).toBe('translateX(-200%)')
    expect(activeIndex(carousel)).toBe(2)

    carousel.next.click()
    expect(carousel.track.style.transform).toBe('translateX(-0%)')
    expect(carousel.prev.disabled).toBe(false)
    expect(carousel.next.disabled).toBe(false)
  })

  it('navigates with ArrowRight and ArrowLeft and prevents their default action', async () => {
    const [carousel] = await mountCarousels([{}])

    const right = new window.KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true })
    carousel.root.dispatchEvent(right)
    expect(right.defaultPrevented).toBe(true)
    expect(activeIndex(carousel)).toBe(1)

    const left = new window.KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true })
    carousel.root.dispatchEvent(left)
    expect(left.defaultPrevented).toBe(true)
    expect(activeIndex(carousel)).toBe(0)

    const other = new window.KeyboardEvent('keydown', { key: 'Enter', cancelable: true })
    carousel.root.dispatchEvent(other)
    expect(other.defaultPrevented).toBe(false)
    expect(activeIndex(carousel)).toBe(0)
  })

  it('advances every autoplay interval', async () => {
    vi.useFakeTimers()
    const [carousel] = await mountCarousels([{ autoplay: 1000, loop: true }])

    vi.advanceTimersByTime(999)
    expect(activeIndex(carousel)).toBe(0)
    vi.advanceTimersByTime(1)
    expect(activeIndex(carousel)).toBe(1)
    vi.advanceTimersByTime(2000)
    expect(activeIndex(carousel)).toBe(0)
  })

  it('restarts the autoplay interval after manual navigation', async () => {
    vi.useFakeTimers()
    const [carousel] = await mountCarousels([{ autoplay: 1000, loop: true }])

    vi.advanceTimersByTime(600)
    carousel.next.click()
    expect(activeIndex(carousel)).toBe(1)

    vi.advanceTimersByTime(999)
    expect(activeIndex(carousel)).toBe(1)
    vi.advanceTimersByTime(1)
    expect(activeIndex(carousel)).toBe(2)
  })

  it('pauses autoplay on mouseenter and resumes it on mouseleave', async () => {
    vi.useFakeTimers()
    const [carousel] = await mountCarousels([{ autoplay: 1000, loop: true }])

    carousel.root.dispatchEvent(new window.Event('mouseenter'))
    vi.advanceTimersByTime(5000)
    expect(activeIndex(carousel)).toBe(0)

    carousel.root.dispatchEvent(new window.Event('mouseleave'))
    vi.advanceTimersByTime(1000)
    expect(activeIndex(carousel)).toBe(1)
  })

  it('does not autoplay without an autoplay interval', async () => {
    vi.useFakeTimers()
    const [carousel] = await mountCarousels([{ loop: true }])

    vi.advanceTimersByTime(60_000)
    expect(activeIndex(carousel)).toBe(0)
  })

  it('follows the pointer while dragging and toggles the dragging class', async () => {
    const [carousel] = await mountCarousels([{}])
    carousel.next.click()

    const down = new window.MouseEvent('mousedown', { clientX: 300, cancelable: true })
    carousel.track.dispatchEvent(down)
    expect(down.defaultPrevented).toBe(true)
    expect(carousel.track.classList.contains('dragging')).toBe(true)

    document.dispatchEvent(new window.MouseEvent('mousemove', { clientX: 250 }))
    expect(carousel.track.style.transform).toBe('translateX(-110%)')

    document.dispatchEvent(new window.MouseEvent('mouseup'))
    expect(carousel.track.classList.contains('dragging')).toBe(false)
    expect(carousel.track.style.transform).toBe('translateX(-100%)')
  })

  it('changes slide only when a mouse drag passes 20% of the width', async () => {
    const [carousel] = await mountCarousels([{}])

    mouseDrag(carousel, 300, 200)
    expect(activeIndex(carousel)).toBe(0)

    mouseDrag(carousel, 300, 199)
    expect(activeIndex(carousel)).toBe(1)

    mouseDrag(carousel, 100, 201)
    expect(activeIndex(carousel)).toBe(0)
  })

  it('ignores pointer moves and releases when no drag started', async () => {
    const [carousel] = await mountCarousels([{}])

    document.dispatchEvent(new window.MouseEvent('mousemove', { clientX: 10 }))
    document.dispatchEvent(new window.MouseEvent('mouseup'))

    expect(carousel.track.style.transform).toBe('translateX(-0%)')
    expect(activeIndex(carousel)).toBe(0)
  })

  it('changes slide with a touch swipe past the threshold', async () => {
    const [carousel] = await mountCarousels([{}])

    carousel.track.dispatchEvent(touchEvent('touchstart', 400))
    expect(carousel.track.classList.contains('dragging')).toBe(true)
    document.dispatchEvent(touchEvent('touchmove', 200))
    expect(carousel.track.style.transform).toBe('translateX(-40%)')
    document.dispatchEvent(new window.Event('touchend'))

    expect(carousel.track.classList.contains('dragging')).toBe(false)
    expect(activeIndex(carousel)).toBe(1)
  })

  it('moves only the clicked carousel by exactly one slide when two share the page', async () => {
    const [first, second] = await mountCarousels([{}, {}])

    first.next.click()

    expect(first.track.style.transform).toBe('translateX(-100%)')
    expect(activeIndex(first)).toBe(1)
    expect(first.dots()).toHaveLength(3)
    expect(second.track.style.transform).toBe('translateX(-0%)')
    expect(activeIndex(second)).toBe(0)
  })
})
