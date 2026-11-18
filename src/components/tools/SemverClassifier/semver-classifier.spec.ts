import { cleanup, fireEvent, render, screen } from '@testing-library/preact'
import { h } from 'preact'
import { afterEach, describe, expect, it } from 'vitest'

import { SemverClassifier, type SemverCopy } from './SemverClassifier'

const copy: SemverCopy = {
  installedLabel: 'Installed version',
  candidateLabel: 'New version',
  resultLabel: 'Group',
  groups: { review: 'Major version: review the changes', bump: 'Version bump only' },
  bumps: { patch: 'patch', minor: 'minor', major: 'major' },
  summary: 'From {from} to {to}: a {bump} jump.',
  belowOne: 'Below 1.0.0 this jump counts as a major.',
  current: '{to} is not newer than {from}.',
  invalidInstalled: 'The installed version is not a version.',
  invalidCandidate: 'The new version is not a version.',
}

const result = (): HTMLElement => screen.getByRole('status')

afterEach(() => {
  cleanup()
})

describe('SemverClassifier', () => {
  it('starts on a 0.x example and explains the 1.0.0 rule', () => {
    render(h(SemverClassifier, { copy }))
    expect(screen.getByLabelText('Installed version')).toHaveProperty('value', '0.3.1')
    expect(result().textContent).toContain('Major version: review the changes')
    expect(result().textContent).toContain('From 0.3.1 to 0.4.0: a major jump.')
    expect(result().textContent).toContain('Below 1.0.0 this jump counts as a major.')
  })

  it('reclassifies as the versions are typed', () => {
    render(h(SemverClassifier, { copy, installed: '1.2.3', candidate: '1.2.4' }))
    expect(result().textContent).toContain('Version bump only')
    expect(result().textContent).not.toContain('Below 1.0.0')

    fireEvent.input(screen.getByLabelText('New version'), { target: { value: '2.0.0' } })
    expect(result().textContent).toContain('Major version: review the changes')
    expect(result().querySelector('.semver-group-review')).not.toBeNull()
  })

  it('reports a current version and an unreadable one', () => {
    render(h(SemverClassifier, { copy, installed: '2.0.0', candidate: '1.0.0' }))
    expect(result().textContent).toContain('1.0.0 is not newer than 2.0.0.')

    fireEvent.input(screen.getByLabelText('Installed version'), { target: { value: 'latest' } })
    expect(result().textContent).toContain('The installed version is not a version.')
    expect(result().querySelector('.tool-result-note')).toBeNull()

    fireEvent.input(screen.getByLabelText('Installed version'), { target: { value: '1.0.0' } })
    fireEvent.input(screen.getByLabelText('New version'), { target: { value: 'next' } })
    expect(result().textContent).toContain('The new version is not a version.')
  })
})
