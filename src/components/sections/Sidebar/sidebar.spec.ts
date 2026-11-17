// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import Sidebar from './Sidebar.astro'

const scriptHref = ['javascript', 'alert(1)'].join(':')

describe('Sidebar', () => {
  it('renders an action with an unsafe href as a button', async () => {
    const host = await render(Sidebar, {
      props: { actions: [{ label: 'Open', href: scriptHref }] },
    })

    expect(host.querySelector('.sidebar-action')?.tagName).toBe('BUTTON')
    expect(host.querySelector('.sidebar-action')?.hasAttribute('href')).toBe(false)
  })

  it('renders a left <aside> with a collapsed, labelled mobile toggle', async () => {
    const host = await render(Sidebar, { slots: { default: '<p>Content</p>' } })
    const toggle = host.querySelector('button.sidebar-mobile-toggle')

    expect(host.querySelector('aside')?.classList.contains('sidebar-left')).toBe(true)
    expect(host.querySelector('.sidebar-content p')?.textContent).toBe('Content')
    expect(toggle?.getAttribute('aria-label')).toBe('Open menu')
    expect(toggle?.getAttribute('aria-expanded')).toBe('false')
  })

  it('supports the right position', async () => {
    const host = await render(Sidebar, { props: { position: 'right' } })
    expect(host.querySelector('aside')?.classList.contains('sidebar-right')).toBe(true)
  })

  it('renders title, subtitle and a sized, lazy image in the header', async () => {
    const host = await render(Sidebar, {
      props: { title: 'Docs', subtitle: 'v2', image: { src: '/logo.png', alt: 'Logo' } },
    })
    const img = host.querySelector('.sidebar-image img')

    expect(host.querySelector('.sidebar-title')?.textContent).toBe('Docs')
    expect(host.querySelector('.sidebar-subtitle')?.textContent).toBe('v2')
    expect(img?.getAttribute('alt')).toBe('Logo')
    expect(img?.getAttribute('width')).toBe('280')
    expect(img?.getAttribute('height')).toBe('140')
    expect(img?.getAttribute('loading')).toBe('lazy')
  })

  it('shows the avatar instead of the titles when both are given', async () => {
    const host = await render(Sidebar, {
      props: { title: 'Docs', avatar: { name: 'Ada', email: 'ada@example.com' } },
    })

    expect(host.querySelector('.avatar-name')?.textContent).toBe('Ada')
    expect(host.querySelector('.sidebar-titles')).toBeNull()
  })

  it('omits the header when there is nothing to show', async () => {
    const host = await render(Sidebar)
    expect(host.querySelector('.sidebar-header')).toBeNull()
  })

  it('renders actions as links or buttons with active and disabled states', async () => {
    const host = await render(Sidebar, {
      props: {
        actions: [
          { label: 'Home', href: '/', active: true },
          { label: 'Settings' },
          { label: 'Billing', disabled: true },
        ],
      },
    })
    const nav = host.querySelector('nav.sidebar-actions')
    const [home, settings, billing] = [...(nav?.querySelectorAll('.sidebar-action') ?? [])]

    expect(nav?.getAttribute('aria-label')).toBe('Sidebar actions')
    expect(home.tagName).toBe('A')
    expect(home.getAttribute('data-active')).toBe('true')
    expect(settings.tagName).toBe('BUTTON')
    expect(settings.getAttribute('type')).toBe('button')
    expect(billing.getAttribute('data-disabled')).toBe('true')
    expect(billing.getAttribute('tabindex')).toBe('-1')
  })
})
