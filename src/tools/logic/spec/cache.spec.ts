import { describe, expect, it } from 'vitest'

import {
  API_CACHE_MINUTES,
  cacheLeft,
  cacheMinutesFor,
  cacheState,
  PLAN_CACHE_MINUTES,
} from '../cache'

describe('cacheLeft', () => {
  it('counts whole minutes left from the start of the last request, rounding up', () => {
    expect(cacheLeft(0, 5, 0)).toBe(5)
    expect(cacheLeft(0, 5, 61_000)).toBe(4)
    expect(cacheLeft(0, 5, 5 * 60_000)).toBe(0)
    expect(cacheLeft(0, 5, 9 * 60_000)).toBe(0)
  })
})

describe('cacheMinutesFor', () => {
  it('lasts an hour on a subscription and five minutes with an API key', () => {
    expect(PLAN_CACHE_MINUTES).toBe(60)
    expect(API_CACHE_MINUTES).toBe(5)
    expect(cacheMinutesFor('plan', 0)).toBe(60)
    expect(cacheMinutesFor('api', 0)).toBe(5)
  })

  it('keeps a hand-set length between 1 and 1440 minutes, as /narsil cache does', () => {
    expect(cacheMinutesFor('custom', 30)).toBe(30)
    expect(cacheMinutesFor('custom', 0)).toBe(1)
    expect(cacheMinutesFor('custom', 5000)).toBe(1440)
    expect(cacheMinutesFor('custom', Number.NaN)).toBe(1)
  })
})

describe('cacheState', () => {
  it('is warm with the minutes left, then cold', () => {
    expect(cacheState(60, 20)).toEqual({ kind: 'warm', left: 40, spent: 33 })
    expect(cacheState(5, 5)).toEqual({ kind: 'cold' })
    expect(cacheState(5, -3)).toEqual({ kind: 'warm', left: 5, spent: 0 })
  })
})
