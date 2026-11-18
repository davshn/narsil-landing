export const PLAN_CACHE_MINUTES = 60
export const API_CACHE_MINUTES = 5

const MINUTE_MS = 60_000
const MAX_CACHE_MINUTES = 1440

export type Account = 'plan' | 'api' | 'custom'

export type CacheState = { kind: 'warm'; left: number; spent: number } | { kind: 'cold' }

export function cacheLeft(at: number, minutes: number, now: number): number {
  return Math.max(0, Math.ceil((at + minutes * MINUTE_MS - now) / MINUTE_MS))
}

export function cacheMinutesFor(account: Account, custom: number): number {
  if (account === 'plan') return PLAN_CACHE_MINUTES
  if (account === 'api') return API_CACHE_MINUTES
  const minutes = Number.isFinite(custom) ? Math.round(custom) : 1
  return Math.min(MAX_CACHE_MINUTES, Math.max(1, minutes))
}

export function cacheState(minutes: number, elapsed: number): CacheState {
  const since = Math.max(0, elapsed)
  const left = cacheLeft(0, minutes, since * MINUTE_MS)
  if (left === 0) return { kind: 'cold' }
  return { kind: 'warm', left, spent: Math.round((since / minutes) * 100) }
}
