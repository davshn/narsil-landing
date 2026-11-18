import { describe, expect, it } from 'vitest'

import { bumpOf, classify, compare, parseVersion, show, type Version } from '../semver'

const v = (text: string): Version => {
  const version = parseVersion(text)
  if (version === undefined) throw new Error(`Not a version: ${text}`)
  return version
}

describe('parseVersion', () => {
  it('reads full, partial, prefixed, prerelease and build versions', () => {
    expect(parseVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, pre: '' })
    expect(parseVersion(' v2.0 ')).toEqual({ major: 2, minor: 0, patch: 0, pre: '' })
    expect(parseVersion('3.0.0-rc.1+build.5')).toEqual({
      major: 3,
      minor: 0,
      patch: 0,
      pre: 'rc.1',
    })
    expect(parseVersion('5.6.15.Final')).toEqual({ major: 5, minor: 6, patch: 15, pre: 'Final' })
    expect(parseVersion('8.1.4.1')).toEqual({ major: 8, minor: 1, patch: 4, pre: '', rest: [1] })
  })

  it('rejects what is not a version', () => {
    ;['', 'latest', '^1.2.3', '1..2', 'one.two'].forEach((text) => {
      expect(parseVersion(text)).toBeUndefined()
    })
  })
})

describe('compare and show', () => {
  it('orders by number, by extra parts, and puts a prerelease before its release', () => {
    expect(compare(v('1.10.0'), v('1.9.9'))).toBeGreaterThan(0)
    expect(compare(v('8.1.4.1'), v('8.1.4'))).toBeGreaterThan(0)
    expect(compare(v('2.0.0-rc.1'), v('2.0.0'))).toBeLessThan(0)
    expect(compare(v('2.0.0-alpha'), v('2.0.0-beta'))).toBeLessThan(0)
    expect(compare(v('2.0.0-beta'), v('2.0.0-alpha'))).toBeGreaterThan(0)
    expect(compare(v('2.0.0'), v('2.0.0-rc.1'))).toBeGreaterThan(0)
    expect(compare(v('1.2.3'), v('v1.2.3'))).toBe(0)
  })

  it('writes a version back in full', () => {
    expect(show(v('v2'))).toBe('2.0.0')
    expect(show(v('8.1.4.1-rc'))).toBe('8.1.4.1-rc')
  })
})

describe('bumpOf', () => {
  it('names the jump from 1.0.0 on', () => {
    expect(bumpOf(v('1.2.3'), v('1.2.4'))).toBe('patch')
    expect(bumpOf(v('1.2.3'), v('1.3.0'))).toBe('minor')
    expect(bumpOf(v('1.2.3'), v('2.0.0'))).toBe('major')
    expect(bumpOf(v('1.2.3-rc.1'), v('1.2.3'))).toBe('patch')
  })

  it('treats a minor below 1.0.0, and a patch below 0.1.0, as a major', () => {
    expect(bumpOf(v('0.3.1'), v('0.4.0'))).toBe('major')
    expect(bumpOf(v('0.3.1'), v('0.3.2'))).toBe('patch')
    expect(bumpOf(v('0.0.3'), v('0.0.4'))).toBe('major')
  })

  it('finds no jump to the same or an older version', () => {
    expect(bumpOf(v('1.2.3'), v('1.2.3'))).toBe('none')
    expect(bumpOf(v('2.0.0'), v('1.9.0'))).toBe('none')
  })
})

describe('classify', () => {
  it('puts a major in the review group and a patch or minor in the bump group', () => {
    expect(classify('1.2.3', '2.0.0')).toEqual({
      kind: 'upgrade',
      from: '1.2.3',
      to: '2.0.0',
      bump: 'major',
      group: 'review',
      belowOne: false,
    })
    expect(classify('1.2.3', '1.3.0')).toMatchObject({
      bump: 'minor',
      group: 'bump',
      belowOne: false,
    })
    expect(classify('1.2.3', '1.2.4')).toMatchObject({ bump: 'patch', group: 'bump' })
  })

  it('says when the 1.0.0 rule raised a minor or a patch to a major', () => {
    expect(classify('0.3.1', '0.4.0')).toMatchObject({
      bump: 'major',
      group: 'review',
      belowOne: true,
    })
    expect(classify('0.0.3', '0.0.4')).toMatchObject({ bump: 'major', belowOne: true })
    expect(classify('0.9.0', '1.0.0')).toMatchObject({ bump: 'major', belowOne: false })
  })

  it('reports a current version and each unreadable side', () => {
    expect(classify('1.2.3', '1.2.3')).toEqual({ kind: 'current', from: '1.2.3', to: '1.2.3' })
    expect(classify('2.0.0', '1.0.0')).toEqual({ kind: 'current', from: '2.0.0', to: '1.0.0' })
    expect(classify('latest', '1.0.0')).toEqual({ kind: 'invalid', side: 'installed' })
    expect(classify('1.0.0', '')).toEqual({ kind: 'invalid', side: 'candidate' })
  })
})
