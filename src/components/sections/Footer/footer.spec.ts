// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import Footer from './Footer.astro'

const scriptHref = ['javascript', 'alert(1)'].join(':')

describe('Footer', () => {
  it('drops unsafe social and group link hrefs', async () => {
    const host = await render(Footer, {
      props: {
        social: [{ icon: 'lucide:github', href: scriptHref, label: 'GitHub' }],
        groups: [{ title: 'Product', links: [{ label: 'Docs', href: scriptHref }] }],
      },
    })
    const anchors = [...host.querySelectorAll('.footer-social-link, .footer-link')]

    expect(anchors).toHaveLength(2)
    expect(anchors.every((a) => !a.hasAttribute('href'))).toBe(true)
  })

  it('renders a <footer> with brand and description', async () => {
    const host = await render(Footer, { props: { brand: 'Acme', description: 'Tools for teams' } })

    expect(host.querySelector('footer.footer .footer-brand')?.textContent).toBe('Acme')
    expect(host.querySelector('.footer-description')?.textContent).toBe('Tools for teams')
  })

  it('renders link groups as lists', async () => {
    const host = await render(Footer, {
      props: {
        groups: [{ title: 'Product', links: [{ label: 'Pricing', href: '/pricing' }] }],
      },
    })
    const link = host.querySelector('.footer-group ul li a.footer-link')

    expect(host.querySelector('.footer-group-title')?.textContent).toBe('Product')
    expect(link?.getAttribute('href')).toBe('/pricing')
    expect(link?.textContent.trim()).toBe('Pricing')
  })

  it('opens labelled social links safely in a new tab', async () => {
    const host = await render(Footer, {
      props: { social: [{ icon: 'lucide:github', href: 'https://github.com', label: 'GitHub' }] },
    })
    const link = host.querySelector('a.footer-social-link')

    expect(link?.getAttribute('aria-label')).toBe('GitHub')
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('builds a default copyright with the current year and brand', async () => {
    const host = await render(Footer, { props: { brand: 'Acme' } })
    const year = new Date().getFullYear()

    expect(host.querySelector('.footer-copyright')?.textContent).toBe(
      `${year} Acme. All rights reserved.`,
    )
  })

  it('uses a custom copyright when given and omits empty sections', async () => {
    const host = await render(Footer, { props: { copyright: '© Acme Inc.' } })

    expect(host.querySelector('.footer-copyright')?.textContent).toBe('© Acme Inc.')
    expect(host.querySelector('.footer-groups')).toBeNull()
    expect(host.querySelector('.footer-social')).toBeNull()
  })
})
