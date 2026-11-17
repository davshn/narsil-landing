// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import Carousel from './Carousel.astro'

const slides = '<div class="carousel-slide">1</div><div class="carousel-slide">2</div>'

describe('Carousel', () => {
  it('renders a labelled carousel region with its slides', async () => {
    const host = await render(Carousel, { slots: { default: slides } })
    const region = host.querySelector('[role="region"]')

    expect(region?.getAttribute('aria-roledescription')).toBe('carousel')
    expect(region?.getAttribute('aria-label')).toBe('Carousel')
    expect(region?.querySelectorAll('[data-carousel-track] .carousel-slide')).toHaveLength(2)
  })

  it('uses a custom accessible name', async () => {
    const host = await render(Carousel, { props: { label: 'Testimonials' } })
    expect(host.querySelector('[role="region"]')?.getAttribute('aria-label')).toBe('Testimonials')
  })

  it('renders labelled previous and next buttons and the dots container by default', async () => {
    const host = await render(Carousel)

    expect(host.querySelector('[data-carousel-prev]')?.getAttribute('aria-label')).toBe(
      'Previous slide',
    )
    expect(host.querySelector('[data-carousel-next]')?.getAttribute('aria-label')).toBe(
      'Next slide',
    )
    expect(host.querySelector('[data-carousel-dots]')?.getAttribute('role')).toBe('tablist')
  })

  it('hides arrows and dots on request', async () => {
    const host = await render(Carousel, { props: { showArrows: false, showDots: false } })

    expect(host.querySelector('.carousel-arrows')).toBeNull()
    expect(host.querySelector('[data-carousel-dots]')).toBeNull()
  })

  it('exposes autoplay and loop settings to the script only when enabled', async () => {
    const enabled = await render(Carousel, { props: { autoplay: 4000, loop: true } })
    const disabled = await render(Carousel)
    const on = enabled.querySelector('[data-carousel]')
    const off = disabled.querySelector('[data-carousel]')

    expect(on?.getAttribute('data-autoplay')).toBe('4000')
    expect(on?.getAttribute('data-loop')).toBe('true')
    expect(off?.hasAttribute('data-autoplay')).toBe(false)
    expect(off?.hasAttribute('data-loop')).toBe(false)
  })
})
