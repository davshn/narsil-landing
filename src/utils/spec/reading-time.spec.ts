import { describe, expect, it } from 'vitest'

import { readingDuration, readingMinutes } from '../reading-time'

describe('readingMinutes', () => {
  it('counts the words at 200 a minute, rounded', () => {
    expect(readingMinutes(Array.from({ length: 1000 }, () => 'word').join(' '))).toBe(5)
    expect(readingMinutes(Array.from({ length: 1100 }, () => 'word').join(' \n'))).toBe(6)
  })

  it('gives a short text at least one minute and an empty one none', () => {
    expect(readingMinutes('Just a few words.')).toBe(1)
    expect(readingMinutes('   \n ')).toBe(0)
  })

  it('accepts another reading speed', () => {
    expect(readingMinutes(Array.from({ length: 300 }, () => 'w').join(' '), 100)).toBe(3)
  })
})

describe('readingDuration', () => {
  it('keeps minutes below an hour and a half', () => {
    expect(readingDuration(45)).toEqual({ unit: 'minutes', value: 45 })
    expect(readingDuration(89)).toEqual({ unit: 'minutes', value: 89 })
  })

  it('switches to whole hours from an hour and a half', () => {
    expect(readingDuration(90)).toEqual({ unit: 'hours', value: 2 })
    expect(readingDuration(250)).toEqual({ unit: 'hours', value: 4 })
  })

  it('never returns a negative time', () => {
    expect(readingDuration(-3)).toEqual({ unit: 'minutes', value: 0 })
  })
})
