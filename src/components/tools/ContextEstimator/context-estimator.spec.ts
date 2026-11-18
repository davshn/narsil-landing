import { cleanup, fireEvent, render, screen } from '@testing-library/preact'
import { h } from 'preact'
import { afterEach, describe, expect, it } from 'vitest'

import { ContextEstimator, type ContextCopy } from './ContextEstimator'

const copy: ContextCopy = {
  earlierLabel: 'Fill before (%)',
  nowLabel: 'Fill now (%)',
  minutesLabel: 'Minutes between the readings',
  resultLabel: 'Estimate',
  estimate: 'Full in about {minutes} min.',
  far: 'More than two hours away.',
  full: 'The context is full.',
  old: 'Older than 15 minutes.',
  short: 'Less than a minute apart.',
  flat: 'Not growing.',
}

const result = (): HTMLElement => screen.getByRole('status')

afterEach(() => {
  cleanup()
})

describe('ContextEstimator', () => {
  it('starts from an example estimate', () => {
    render(h(ContextEstimator, { copy }))
    expect(result().textContent).toContain('Full in about 25 min.')
  })

  it('explains each case without an estimate as the readings change', () => {
    render(h(ContextEstimator, { copy }))
    const now = screen.getByLabelText('Fill now (%)')
    const minutes = screen.getByLabelText('Minutes between the readings')

    fireEvent.input(now, { target: { value: '100' } })
    expect(result().textContent).toContain('The context is full.')
    fireEvent.input(now, { target: { value: '41' } })
    expect(result().textContent).toContain('More than two hours away.')
    fireEvent.input(now, { target: { value: '' } })
    expect(result().textContent).toContain('Not growing.')

    fireEvent.input(now, { target: { value: '50' } })
    fireEvent.input(minutes, { target: { value: '20' } })
    expect(result().textContent).toContain('Older than 15 minutes.')
    fireEvent.input(minutes, { target: { value: '0' } })
    expect(result().textContent).toContain('Less than a minute apart.')
  })
})
