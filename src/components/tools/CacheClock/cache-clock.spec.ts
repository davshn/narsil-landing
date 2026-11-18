import { cleanup, fireEvent, render, screen } from '@testing-library/preact'
import { h } from 'preact'
import { afterEach, describe, expect, it } from 'vitest'

import { CacheClock, type CacheCopy } from './CacheClock'

const copy: CacheCopy = {
  accountLabel: 'How you use Claude Code',
  accounts: { plan: 'Subscription plan', api: 'API key', custom: 'Set by hand' },
  customLabel: 'Cache length (minutes)',
  elapsedLabel: 'Minutes since the last request started',
  resultLabel: 'Prompt cache',
  lasts: 'The cache lasts {minutes} min.',
  warm: 'Cache: {left} min',
  cold: 'Cold cache: the next message is charged in full',
}

const result = (): HTMLElement => screen.getByRole('status')

afterEach(() => {
  cleanup()
})

describe('CacheClock', () => {
  it('starts with an API key, five minutes long, three spent', () => {
    render(h(CacheClock, { copy }))
    expect(result().textContent).toContain('Cache: 2 min')
    expect(result().textContent).toContain('The cache lasts 5 min.')
    expect(screen.queryByLabelText('Cache length (minutes)')).toBeNull()
  })

  it('goes cold with an API key and stays warm on a subscription', () => {
    render(h(CacheClock, { copy }))
    const elapsed = screen.getByLabelText('Minutes since the last request started')
    fireEvent.input(elapsed, { target: { value: '10' } })
    expect(result().textContent).toContain('Cold cache: the next message is charged in full')
    expect(result().querySelector('.cache-cold')).not.toBeNull()

    fireEvent.click(screen.getByLabelText('Subscription plan'))
    expect(result().textContent).toContain('Cache: 50 min')
    expect(result().textContent).toContain('The cache lasts 60 min.')
  })

  it('takes a length set by hand', () => {
    render(h(CacheClock, { copy }))
    fireEvent.click(screen.getByLabelText('Set by hand'))
    const custom = screen.getByLabelText('Cache length (minutes)')
    fireEvent.input(custom, { target: { value: '15' } })
    expect(result().textContent).toContain('Cache: 12 min')
    fireEvent.input(custom, { target: { value: '' } })
    fireEvent.input(screen.getByLabelText('Minutes since the last request started'), {
      target: { value: '' },
    })
    expect(result().textContent).toContain('The cache lasts 1 min.')
    expect(result().textContent).toContain('Cache: 1 min')
  })
})
