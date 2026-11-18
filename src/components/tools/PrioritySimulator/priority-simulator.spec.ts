import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact'
import { h } from 'preact'
import { afterEach, describe, expect, it } from 'vitest'

import { PrioritySimulator, type PriorityCopy } from './PrioritySimulator'

const copy: PriorityCopy = {
  statuses: {
    error: 'Error',
    waiting: 'Needs you',
    working: 'Working',
    done: 'Done',
    idle: 'Idle',
  },
  own: 'This conversation',
  other: 'Conversation {n}',
  statusLabel: 'State',
  minutesLabel: 'Minutes since its last change',
  add: 'Add a conversation',
  remove: 'Remove {name}',
  wearsLabel: 'Narsil shows',
  wears: '{name}: {status}',
  rowsLabel: 'Band rows',
  page: 'Page {page}',
}

const result = (): HTMLElement => screen.getByRole('status')
const rows = (): string[] =>
  within(result())
    .getAllByRole('listitem')
    .map((row) => row.textContent)

afterEach(() => {
  cleanup()
})

describe('PrioritySimulator', () => {
  it('wears the conversation that needs you and keeps its own first in the rows', () => {
    render(h(PrioritySimulator, { copy }))
    expect(result().textContent).toContain('Conversation 3: Needs you')
    expect(rows()).toEqual([
      'This conversation · Working',
      'Conversation 3 · Needs you',
      'Conversation 2 · Done',
    ])
  })

  it('reranks when a state or a time changes', () => {
    render(h(PrioritySimulator, { copy }))
    const [ownState, secondState] = screen.getAllByLabelText('State')
    fireEvent.change(secondState, { target: { value: 'error' } })
    expect(result().textContent).toContain('Conversation 2: Error')

    fireEvent.change(ownState, { target: { value: 'error' } })
    const [ownMinutes] = screen.getAllByLabelText('Minutes since its last change')
    fireEvent.input(ownMinutes, { target: { value: '0' } })
    expect(result().textContent).toContain('This conversation: Error')

    fireEvent.input(ownMinutes, { target: { value: '' } })
    expect(result().textContent).toContain('This conversation: Error')
  })

  it('adds conversations up to eight, pages the rows four at a time, and removes one', () => {
    render(h(PrioritySimulator, { copy }))
    const add = screen.getByRole('button', { name: 'Add a conversation' })
    ;[1, 2, 3, 4, 5].forEach(() => {
      fireEvent.click(add)
    })
    expect(screen.getAllByLabelText('State')).toHaveLength(8)
    expect(add).toHaveProperty('disabled', true)
    expect(result().textContent).toContain('Page 2')
    expect(screen.queryByRole('button', { name: 'Remove This conversation' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Remove Conversation 2' }))
    expect(screen.getAllByLabelText('State')).toHaveLength(7)
    fireEvent.click(add)
    expect(screen.getAllByLabelText('State')).toHaveLength(8)
  })
})
