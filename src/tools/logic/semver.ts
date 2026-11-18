export interface Version {
  major: number
  minor: number
  patch: number
  pre: string
  rest?: number[]
}

export type Bump = 'none' | 'patch' | 'minor' | 'major'

export type Group = 'review' | 'bump'

export type Classification =
  | { kind: 'invalid'; side: 'installed' | 'candidate' }
  | { kind: 'current'; from: string; to: string }
  | {
      kind: 'upgrade'
      from: string
      to: string
      bump: Exclude<Bump, 'none'>
      group: Group
      belowOne: boolean
    }

const VERSION =
  /^v?(?<major>\d+)(?:\.(?<minor>\d+))?(?:\.(?<patch>\d+))?(?<rest>(?:\.\d+)*)(?:[\-.](?<pre>[0-9A-Za-z][0-9A-Za-z.\-]*))?(?:\+[0-9A-Za-z.\-]+)?$/v

export function parseVersion(text: string): Version | undefined {
  const match = VERSION.exec(text.trim())
  if (match === null) return undefined
  const { major = '0', minor = '0', patch = '0', rest = '', pre = '' } = match.groups ?? {}
  const version: Version = {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    pre,
  }
  if (rest !== '') version.rest = rest.slice(1).split('.').map(Number)
  return version
}

function comparePre(a: string, b: string): number {
  if (a === b) return 0
  if (a === '') return 1
  if (b === '') return -1
  return a < b ? -1 : 1
}

export function compare(a: Version, b: Version): number {
  if (a.major !== b.major) return a.major - b.major
  if (a.minor !== b.minor) return a.minor - b.minor
  if (a.patch !== b.patch) return a.patch - b.patch
  const ar = a.rest ?? []
  const br = b.rest ?? []
  const difference = Array.from(
    { length: Math.max(ar.length, br.length) },
    (_, n) => (ar[n] ?? 0) - (br[n] ?? 0),
  ).find((d) => d !== 0)
  if (difference !== undefined) return difference
  return comparePre(a.pre, b.pre)
}

function plainBumpOf(from: Version, to: Version): Bump {
  if (compare(to, from) <= 0) return 'none'
  if (to.major !== from.major) return 'major'
  if (to.minor !== from.minor) return 'minor'
  return 'patch'
}

export function bumpOf(from: Version, to: Version): Bump {
  const plain = plainBumpOf(from, to)
  if (plain === 'minor' && from.major === 0) return 'major'
  if (plain === 'patch' && to.patch !== from.patch && from.major === 0 && from.minor === 0) {
    return 'major'
  }
  return plain
}

export function show(version: Version): string {
  const rest = version.rest === undefined ? '' : `.${version.rest.join('.')}`
  const pre = version.pre === '' ? '' : `-${version.pre}`
  return `${version.major}.${version.minor}.${version.patch}${rest}${pre}`
}

export function classify(installed: string, candidate: string): Classification {
  const from = parseVersion(installed)
  if (from === undefined) return { kind: 'invalid', side: 'installed' }
  const to = parseVersion(candidate)
  if (to === undefined) return { kind: 'invalid', side: 'candidate' }
  const bump = bumpOf(from, to)
  if (bump === 'none') return { kind: 'current', from: show(from), to: show(to) }
  return {
    kind: 'upgrade',
    from: show(from),
    to: show(to),
    bump,
    group: bump === 'major' ? 'review' : 'bump',
    belowOne: plainBumpOf(from, to) !== bump,
  }
}
