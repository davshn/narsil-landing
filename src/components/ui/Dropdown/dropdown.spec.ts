// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import Dropdown from './Dropdown.astro'

const items = [
  { label: 'Edit', href: '/edit', icon: 'lucide:pencil' },
  { label: 'Archive' },
  { label: 'Delete', variant: 'destructive' as const, disabled: true },
]

const scriptHref = ['javascript', 'alert(1)'].join(':')

describe('Dropdown', () => {
  it('renders an item with an unsafe href as a button', async () => {
    const host = await render(Dropdown, { props: { items: [{ label: 'Open', href: scriptHref }] } })

    expect(host.querySelector('.dropdown-item')?.tagName).toBe('BUTTON')
    expect(host.querySelector('.dropdown-item')?.hasAttribute('href')).toBe(false)
  })

  it('renders the trigger slot and a menu linked to it', async () => {
    const host = await render(Dropdown, {
      props: { id: 'actions', items },
      slots: { default: '<button>Actions</button>' },
    })
    const menu = host.querySelector('[role="menu"]')
    const labelledBy = menu?.getAttribute('aria-labelledby') ?? ''

    expect(host.querySelector('[data-dropdown-trigger="actions"] button')).not.toBeNull()
    expect(menu?.id).toBe('actions-menu')
    expect(host.querySelector(`#${labelledBy}`)?.textContent).toContain('Actions')
  })

  it('renders links for items with href and buttons otherwise', async () => {
    const host = await render(Dropdown, { props: { items } })
    const menuItems = host.querySelectorAll('[role="menuitem"]')

    expect(menuItems[0].tagName).toBe('A')
    expect(menuItems[0].getAttribute('href')).toBe('/edit')
    expect(menuItems[1].tagName).toBe('BUTTON')
    expect(menuItems[1].getAttribute('type')).toBe('button')
  })

  it('marks destructive and disabled items and removes disabled ones from the tab order', async () => {
    const host = await render(Dropdown, { props: { items } })
    const [first, , last] = [...host.querySelectorAll('[role="menuitem"]')]

    expect(first.getAttribute('tabindex')).toBe('0')
    expect(last.classList.contains('dropdown-item-destructive')).toBe(true)
    expect(last.getAttribute('data-disabled')).toBe('true')
    expect(last.getAttribute('tabindex')).toBe('-1')
  })

  it('renders section labels with separators between sections', async () => {
    const host = await render(Dropdown, {
      props: {
        sections: [
          { label: 'Account', items: [{ label: 'Profile' }] },
          { items: [{ label: 'Sign out' }] },
        ],
      },
    })

    expect(host.querySelector('.dropdown-label')?.textContent).toBe('Account')
    expect(host.querySelectorAll('.dropdown-separator[role="separator"]')).toHaveLength(1)
    expect(host.querySelectorAll('[role="menuitem"]')).toHaveLength(2)
  })

  it('aligns the menu to the start by default and to the end on request', async () => {
    const start = await render(Dropdown, { props: { items } })
    const end = await render(Dropdown, { props: { items, align: 'end' } })

    expect(start.querySelector('.dropdown-menu')?.classList.contains('dropdown-align-start')).toBe(
      true,
    )
    expect(end.querySelector('.dropdown-menu')?.classList.contains('dropdown-align-end')).toBe(true)
  })
})
