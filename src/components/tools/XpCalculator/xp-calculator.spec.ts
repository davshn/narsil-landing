import { cleanup, fireEvent, render, screen } from '@testing-library/preact'
import { h } from 'preact'
import { afterEach, describe, expect, it } from 'vitest'

import { XpCalculator, type XpCopy } from './XpCalculator'

const copy: XpCopy = {
  turnsLabel: 'Finished turns',
  testsLabel: 'Passing test runs',
  agentsLabel: 'Finished subagents',
  resultLabel: 'Where Narsil stands',
  total: '{xp} XP in total.',
  level: 'Level {level} · {into}/{needed} XP',
  stage: 'Stage {stage} of {stages}.',
  nextStage: 'Stage {stage} starts at level {level}: {xp} XP more, about {turns} turns.',
  grown: 'Narsil is fully grown.',
}

const result = (): HTMLElement => screen.getByRole('status')

afterEach(() => {
  cleanup()
})

describe('XpCalculator', () => {
  it('starts from an example and shows the level, the stage and the next stage', () => {
    render(h(XpCalculator, { copy, locale: 'en' }))
    expect(result().textContent).toContain('Level 3 · 65/300 XP')
    expect(result().textContent).toContain('365 XP in total.')
    expect(result().textContent).toContain('Stage 1 of 5.')
    expect(result().textContent).toContain(
      'Stage 2 starts at level 5: 635 XP more, about 64 turns.',
    )
  })

  it('recomputes as the counts change, and reads an empty field as zero', () => {
    render(h(XpCalculator, { copy, locale: 'en', initial: { turns: 0, tests: 0, agents: 0 } }))
    expect(result().textContent).toContain('Level 1 · 0/100 XP')

    fireEvent.input(screen.getByLabelText('Finished turns'), { target: { value: '6000' } })
    expect(result().textContent).toContain('Level 35')
    expect(result().textContent).toContain('60,000 XP in total.')
    expect(result().textContent).toContain('Narsil is fully grown.')

    fireEvent.input(screen.getByLabelText('Finished turns'), { target: { value: '' } })
    fireEvent.input(screen.getByLabelText('Passing test runs'), { target: { value: '20' } })
    fireEvent.input(screen.getByLabelText('Finished subagents'), { target: { value: '1' } })
    expect(result().textContent).toContain('103 XP in total.')
  })
})
