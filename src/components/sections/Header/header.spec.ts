// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import Header from './Header.astro'

const links = [
  { label: 'Home', href: '/', active: true },
  { label: 'Pricing', href: '/pricing' },
]

const scriptHref = ['javascript', 'alert(1)'].join(':')

describe('Header', () => {
  it('drops unsafe brand and navigation hrefs', async () => {
    const host = await render(Header, {
      props: { brand: 'Acme', brandHref: scriptHref, links: [{ label: 'Home', href: scriptHref }] },
    })
    const anchors = [...host.querySelectorAll('.header-brand, .header-link')]

    expect(anchors.length).toBeGreaterThan(0)
    expect(anchors.every((a) => !a.hasAttribute('href'))).toBe(true)
  })

  it('renders the brand link to the home page by default', async () => {
    const host = await render(Header, { props: { brand: 'Acme' } })
    const brand = host.querySelector('header .header-brand')

    expect(brand?.getAttribute('href')).toBe('/')
    expect(brand?.textContent.trim()).toBe('Acme')
  })

  it('renders desktop and mobile navigation with distinct accessible names', async () => {
    const host = await render(Header, { props: { links } })
    const labels = [...host.querySelectorAll('nav')].map((n) => n.getAttribute('aria-label'))

    expect(labels).toEqual(['Main navigation', 'Main navigation (mobile)'])
  })

  it('uses a custom navigation label', async () => {
    const host = await render(Header, { props: { links, navLabel: 'Docs' } })
    expect(host.querySelector('nav.header-nav')?.getAttribute('aria-label')).toBe('Docs')
  })

  it('renders every link in both menus and flags the active one', async () => {
    const host = await render(Header, { props: { links } })
    const desktop = [...host.querySelectorAll('.header-nav a')]

    expect(desktop.map((a) => a.getAttribute('href'))).toEqual(['/', '/pricing'])
    expect(desktop[0]?.getAttribute('data-active')).toBe('true')
    expect(desktop[1]?.hasAttribute('data-active')).toBe(false)
    expect(host.querySelectorAll('.header-mobile-menu a')).toHaveLength(2)
  })

  it('has a collapsed, labelled mobile menu toggle', async () => {
    const host = await render(Header, { props: { links } })
    const toggle = host.querySelector('button.header-mobile-toggle')

    expect(toggle?.getAttribute('type')).toBe('button')
    expect(toggle?.getAttribute('aria-label')).toBe('Toggle menu')
    expect(toggle?.getAttribute('aria-expanded')).toBe('false')
  })
})

describe('Header actions', () => {
  it('renders the default slot once, in the desktop bar', async () => {
    const host = await render(Header, { slots: { default: '<button id="probe">x</button>' } })

    expect(host.querySelectorAll('#probe')).toHaveLength(1)
    expect(host.querySelector('.header-mobile-menu #probe')).toBeNull()
  })

  it('renders mobile actions only in the mobile menu', async () => {
    const host = await render(Header, {
      slots: { 'mobile-actions': '<a class="probe" href="/x">x</a>' },
    })

    expect(host.querySelectorAll('.probe')).toHaveLength(1)
    expect(host.querySelector('.header-mobile-menu .probe')).not.toBeNull()
  })

  it('renders bar actions once, in the bar next to the menu toggle', async () => {
    const host = await render(Header, {
      slots: { 'bar-actions': '<button id="bar-probe">x</button>' },
    })

    expect(host.querySelectorAll('#bar-probe')).toHaveLength(1)
    expect(host.querySelector('.header-inner > .header-bar-actions #bar-probe')).not.toBeNull()
    expect(host.querySelector('.header-actions #bar-probe')).toBeNull()
  })

  it('leaves out the bar actions container when the slot is empty', async () => {
    const host = await render(Header, { props: { brand: 'Acme' } })

    expect(host.querySelector('.header-bar-actions')).toBeNull()
  })
})
