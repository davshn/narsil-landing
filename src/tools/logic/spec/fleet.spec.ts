import { describe, expect, it } from 'vitest'

import { FLEET_PAGE, fleetOf, type Conversation } from '../fleet'

const conversation = (
  id: string,
  status: Conversation['status'],
  minutesAgo: number,
): Conversation => ({ id, status, minutesAgo })

const ids = (list: readonly Conversation[]): string[] => list.map((c) => c.id)

describe('fleetOf', () => {
  it('wears the most important conversation: error, needs you, working, done, idle', () => {
    const fleet = fleetOf(
      [
        conversation('own', 'idle', 1),
        conversation('docs', 'done', 2),
        conversation('api', 'working', 3),
        conversation('auth', 'waiting', 4),
        conversation('ci', 'error', 5),
      ],
      'own',
    )
    expect(ids(fleet.ranked)).toEqual(['ci', 'auth', 'api', 'docs', 'own'])
    expect(fleet.wearer?.id).toBe('ci')
  })

  it('breaks a tie in state by the most recent change', () => {
    const fleet = fleetOf(
      [conversation('old', 'working', 30), conversation('new', 'working', 2)],
      'old',
    )
    expect(ids(fleet.ranked)).toEqual(['new', 'old'])
  })

  it('lists its own conversation first in the rows, four to a page', () => {
    expect(FLEET_PAGE).toBe(4)
    const list = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, n) => conversation(id, 'done', n))
    const fleet = fleetOf([...list, conversation('own', 'idle', 0)], 'own')
    expect(fleet.wearer?.id).toBe('a')
    expect(fleet.pages.map(ids)).toEqual([
      ['own', 'a', 'b', 'c'],
      ['d', 'e', 'f'],
    ])
  })

  it('has no wearer and one empty page for no conversations', () => {
    expect(fleetOf([], 'own')).toEqual({ ranked: [], wearer: undefined, pages: [[]] })
  })
})
