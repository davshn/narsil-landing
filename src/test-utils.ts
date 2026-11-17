import { expect } from 'vitest'

export function assertTokenNaming(map: Record<string, string>, cssPrefix: string): void {
  const expectedStart = `--${cssPrefix}-`
  for (const [key, value] of Object.entries(map)) {
    expect(
      value.startsWith(expectedStart),
      `Token "${key}" → "${value}" must start with "${expectedStart}"`,
    ).toBe(true)
    const name = value.slice(expectedStart.length)
    expect(
      /^[a-z\d][a-z\d\-]*$/v.test(name),
      `Token "${key}" → name "${name}" has invalid characters (only a-z, 0-9, -)`,
    ).toBe(true)
  }
}

export function assertNoDuplicateValues(map: Record<string, string>): void {
  const seen = new Set<string>()
  const dupes: string[] = []

  for (const value of Object.values(map)) {
    if (seen.has(value)) dupes.push(value)
    else seen.add(value)
  }

  if (dupes.length > 0) {
    expect.fail(`Duplicate token values: ${dupes.join(', ')}`)
  }
}

export function assertHasKeys<T extends Record<string, unknown>>(
  map: T,
  required: Array<keyof T>,
): void {
  const keys = Object.keys(map)
  for (const key of required) {
    expect(keys, `Token map is missing the required key "${String(key)}"`).toContain(String(key))
  }
}

export function assertValuesStartWith(map: Record<string, string>, prefix: string): void {
  for (const [key, value] of Object.entries(map)) {
    expect(
      value.startsWith(prefix),
      `Token "${key}" → "${value}" must start with "${prefix}"`,
    ).toBe(true)
  }
}
