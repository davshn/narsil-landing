// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import Tooltip from './Tooltip.astro'

describe('Tooltip', () => {
  it('renders the trigger slot and a top tooltip by default', async () => {
    const host = await render(Tooltip, {
      props: { text: 'Copy' },
      slots: { default: '<button>Copy</button>' },
    })
    const tooltip = host.querySelector('[role="tooltip"]')

    expect(host.querySelector('.tooltip-wrapper > button')).not.toBeNull()
    expect(tooltip?.classList.contains('tooltip-top')).toBe(true)
    expect(tooltip?.querySelector('.tooltip-text')?.textContent).toBe('Copy')
  })

  it.each(['top', 'bottom', 'left', 'right'])(
    'applies the tooltip-%s position',
    async (position) => {
      const host = await render(Tooltip, { props: { text: 'Hi', position } })
      expect(host.querySelector('.tooltip')?.classList.contains(`tooltip-${position}`)).toBe(true)
    },
  )

  it('splits a keyboard shortcut into <kbd> keys with separators', async () => {
    const host = await render(Tooltip, { props: { text: 'Save', kbd: 'Ctrl + S' } })
    const keys = [...host.querySelectorAll('kbd.tooltip-kbd')].map((k) => k.textContent)

    expect(keys).toEqual(['Ctrl', 'S'])
    expect(host.querySelectorAll('.tooltip-kbd-sep')).toHaveLength(1)
  })

  it('omits the shortcut group without kbd', async () => {
    const host = await render(Tooltip, { props: { text: 'Save' } })
    expect(host.querySelector('.tooltip-kbd-group')).toBeNull()
  })
})
