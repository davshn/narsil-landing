import { describe, expect, it } from 'vitest'

import { estimateFill, MAX_ESTIMATE_MINUTES, minutesToFull } from '../context'

describe('minutesToFull', () => {
  it('projects the pace of the readings to 100 %', () => {
    const now = 20 * 60_000
    const samples = [
      { at: 10 * 60_000, percent: 40 },
      { at: 15 * 60_000, percent: 45 },
      { at: now, percent: 50 },
    ]
    expect(minutesToFull(samples, now)).toBe(50)
  })

  it('keeps only the readings of the last 15 minutes', () => {
    const now = 30 * 60_000
    const samples = [
      { at: 0, percent: 0 },
      { at: 20 * 60_000, percent: 80 },
      { at: now, percent: 90 },
    ]
    expect(minutesToFull(samples, now)).toBe(10)
  })

  it('has no estimate under a minute of readings, or when the fill is not growing', () => {
    expect(minutesToFull([], 0)).toBeNull()
    expect(
      minutesToFull(
        [
          { at: 0, percent: 10 },
          { at: 30_000, percent: 20 },
        ],
        30_000,
      ),
    ).toBeNull()
    expect(
      minutesToFull(
        [
          { at: 0, percent: 30 },
          { at: 120_000, percent: 30 },
        ],
        120_000,
      ),
    ).toBeNull()
  })

  it('never goes below zero once the window is past full', () => {
    expect(
      minutesToFull(
        [
          { at: 0, percent: 90 },
          { at: 60_000, percent: 105 },
        ],
        60_000,
      ),
    ).toBe(0)
  })
})

describe('estimateFill', () => {
  it('estimates from two readings a few minutes apart', () => {
    expect(estimateFill({ earlier: 40, now: 50, minutes: 5 })).toEqual({
      kind: 'estimate',
      minutes: 25,
    })
  })

  it('hides an estimate past two hours', () => {
    expect(MAX_ESTIMATE_MINUTES).toBe(120)
    expect(estimateFill({ earlier: 10, now: 11, minutes: 10 })).toEqual({ kind: 'far' })
  })

  it('names why there is no estimate', () => {
    expect(estimateFill({ earlier: 40, now: 100, minutes: 5 })).toEqual({ kind: 'full' })
    expect(estimateFill({ earlier: 40, now: 50, minutes: 20 })).toEqual({ kind: 'old' })
    expect(estimateFill({ earlier: 40, now: 50, minutes: 0.5 })).toEqual({ kind: 'short' })
    expect(estimateFill({ earlier: 50, now: 40, minutes: 5 })).toEqual({ kind: 'flat' })
  })
})
