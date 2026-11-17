// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import Table from './Table.astro'

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'role', label: 'Role', align: 'center' as const },
  { key: 'score', label: 'Score', align: 'right' as const },
]
const rows = [
  { name: 'Ada', role: 'Engineer', score: 98 },
  { name: 'Alan', score: 91 },
]

describe('Table', () => {
  it('renders one header cell per column and one row per item', async () => {
    const host = await render(Table, { props: { columns, rows } })
    const headers = [...host.querySelectorAll('thead th')].map((th) => th.textContent.trim())

    expect(headers).toEqual(['Name', 'Role', 'Score'])
    expect(host.querySelectorAll('tbody tr.table-row')).toHaveLength(2)
  })

  it('renders cell values in column order and blanks for missing keys', async () => {
    const host = await render(Table, { props: { columns, rows } })
    const secondRow = [...host.querySelectorAll('tbody tr')[1].querySelectorAll('td')].map((td) =>
      td.textContent.trim(),
    )

    expect(secondRow).toEqual(['Alan', '', '91'])
  })

  it('aligns header and body cells per column', async () => {
    const host = await render(Table, { props: { columns, rows } })
    const headerClasses = [...host.querySelectorAll('thead th')].map((th) => th.className)
    const cellClasses = [...host.querySelectorAll('tbody tr')[0].querySelectorAll('td')].map(
      (td) => td.className,
    )

    for (const classes of [headerClasses, cellClasses]) {
      expect(classes[0]).toContain('text-left')
      expect(classes[1]).toContain('text-center')
      expect(classes[2]).toContain('text-right')
    }
  })

  it('renders a caption only when provided', async () => {
    const withCaption = await render(Table, { props: { columns, rows, caption: 'Team' } })
    const without = await render(Table, { props: { columns, rows } })

    expect(withCaption.querySelector('caption')?.textContent).toBe('Team')
    expect(without.querySelector('caption')).toBeNull()
  })

  it('applies default md hoverable classes and allows overrides', async () => {
    const defaults = await render(Table, { props: { columns, rows } })
    const custom = await render(Table, {
      props: { columns, rows, variant: 'striped', size: 'sm', hoverable: false },
    })

    expect([...(defaults.querySelector('.table-wrapper')?.classList ?? [])]).toEqual(
      expect.arrayContaining(['table-default', 'table-md', 'table-hoverable']),
    )
    const customClasses = [...(custom.querySelector('.table-wrapper')?.classList ?? [])]
    expect(customClasses).toEqual(expect.arrayContaining(['table-striped', 'table-sm']))
    expect(customClasses).not.toContain('table-hoverable')
  })
})
