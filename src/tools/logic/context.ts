export interface ContextSample {
  at: number
  percent: number
}

const BURN_WINDOW_MS = 15 * 60_000
const MINUTE_MS = 60_000

export const MAX_ESTIMATE_MINUTES = 120

export function minutesToFull(samples: readonly ContextSample[], now: number): number | null {
  const recent = samples.filter((sample) => now - sample.at <= BURN_WINDOW_MS)
  const first = recent.at(0)
  const last = recent.at(-1)
  if (first === undefined || last === undefined) return null
  const minutes = (last.at - first.at) / MINUTE_MS
  if (minutes < 1 || last.percent <= first.percent) return null
  const perMinute = (last.percent - first.percent) / minutes
  return Math.max(0, Math.round((100 - last.percent) / perMinute))
}

export interface Readings {
  earlier: number
  now: number
  minutes: number
}

export type Estimate =
  { kind: 'estimate'; minutes: number } | { kind: 'far' | 'full' | 'old' | 'short' | 'flat' }

export function estimateFill(readings: Readings): Estimate {
  if (readings.now >= 100) return { kind: 'full' }
  const span = readings.minutes * MINUTE_MS
  if (span > BURN_WINDOW_MS) return { kind: 'old' }
  if (readings.minutes < 1) return { kind: 'short' }
  const minutes = minutesToFull(
    [
      { at: 0, percent: readings.earlier },
      { at: span, percent: readings.now },
    ],
    span,
  )
  if (minutes === null) return { kind: 'flat' }
  if (minutes > MAX_ESTIMATE_MINUTES) return { kind: 'far' }
  return { kind: 'estimate', minutes }
}
