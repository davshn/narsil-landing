import { describe, expect, it } from 'vitest'

import { growthOf, levelOf, stageOf, STAGE_FROM, xpToReach } from '../xp'

describe('levelOf', () => {
  it('needs 100 XP for level 2, 200 more for level 3, and so on', () => {
    expect(levelOf(0)).toEqual({ level: 1, into: 0, needed: 100 })
    expect(levelOf(99)).toEqual({ level: 1, into: 99, needed: 100 })
    expect(levelOf(100)).toEqual({ level: 2, into: 0, needed: 200 })
    expect(levelOf(420)).toEqual({ level: 3, into: 120, needed: 300 })
  })

  it('reads a negative or fractional amount as whole XP from zero', () => {
    expect(levelOf(-50)).toEqual({ level: 1, into: 0, needed: 100 })
    expect(levelOf(150.9)).toEqual({ level: 2, into: 50, needed: 200 })
  })
})

describe('stageOf and xpToReach', () => {
  it('starts each of the five stages at levels 1, 5, 10, 20 and 35', () => {
    expect(STAGE_FROM).toEqual([1, 5, 10, 20, 35])
    expect([1, 4, 5, 9, 10, 19, 20, 34, 35, 80].map(stageOf)).toEqual([
      1, 1, 2, 2, 3, 3, 4, 4, 5, 5,
    ])
    expect(stageOf(0)).toBe(1)
  })

  it('gives the total XP to reach a level, as the guide table does', () => {
    expect(STAGE_FROM.map(xpToReach)).toEqual([0, 1000, 4500, 19000, 59500])
    expect(xpToReach(0)).toBe(0)
  })
})

describe('growthOf', () => {
  it('adds 10 XP a turn, 5 a passing test run and 3 a finished subagent', () => {
    expect(growthOf({ turns: 30, tests: 10, agents: 5 })).toEqual({
      xp: 365,
      level: 3,
      into: 65,
      needed: 300,
      stage: 1,
      nextStage: { stage: 2, level: 5, xpLeft: 635, turnsLeft: 64 },
    })
  })

  it('ignores negative or fractional counts', () => {
    expect(growthOf({ turns: -3, tests: 1.5, agents: Number.NaN }).xp).toBe(5)
  })

  it('has no next stage once Narsil is grown', () => {
    const grown = growthOf({ turns: 6000, tests: 0, agents: 0 })
    expect(grown).toMatchObject({ xp: 60000, level: 35, stage: 5, nextStage: undefined })
  })
})
