const WORDS_PER_MINUTE = 200
const HOURS_FROM_MINUTES = 90

export interface ReadingDuration {
  unit: 'minutes' | 'hours'
  value: number
}

export function readingMinutes(text: string, wordsPerMinute = WORDS_PER_MINUTE): number {
  const { length: words } = text.split(/\s+/v).filter((word) => word !== '')
  if (words === 0) return 0
  return Math.max(1, Math.round(words / wordsPerMinute))
}

export function readingDuration(minutes: number): ReadingDuration {
  if (minutes < HOURS_FROM_MINUTES) return { unit: 'minutes', value: Math.max(0, minutes) }
  return { unit: 'hours', value: Math.round(minutes / 60) }
}
