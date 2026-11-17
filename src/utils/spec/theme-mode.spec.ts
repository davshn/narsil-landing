import { describe, expect, it } from 'vitest'

import { STORAGE_KEY, THEME_MODES, type ResolvedTheme, resolveTheme } from '../theme-mode'

describe('THEME_MODES', () => {
  it('contains light, dark, and system', () => {
    expect(THEME_MODES).toContain('light')
    expect(THEME_MODES).toContain('dark')
    expect(THEME_MODES).toContain('system')
  })

  it('has exactly 3 modes', () => {
    expect(THEME_MODES).toHaveLength(3)
  })
})

describe('STORAGE_KEY', () => {
  it('is a non-empty string', () => {
    expect(STORAGE_KEY).toBe('theme')
  })
})

describe('resolveTheme', () => {
  it('returns dark when stored preference is dark', () => {
    const result: ResolvedTheme = resolveTheme('dark', false)
    expect(result).toBe('dark')
  })

  it('returns light when stored preference is light', () => {
    const result: ResolvedTheme = resolveTheme('light', true)
    expect(result).toBe('light')
  })

  it('returns dark when stored preference is system and system prefers dark', () => {
    const result: ResolvedTheme = resolveTheme('system', true)
    expect(result).toBe('dark')
  })

  it('returns light when stored preference is system and system prefers light', () => {
    const result: ResolvedTheme = resolveTheme('system', false)
    expect(result).toBe('light')
  })

  it('falls back to system when stored value is null (no localStorage entry)', () => {
    const result: ResolvedTheme = resolveTheme(null, true)
    expect(result).toBe('dark')
  })

  it('falls back to system when stored value is null and system prefers light', () => {
    const result: ResolvedTheme = resolveTheme(null, false)
    expect(result).toBe('light')
  })

  it('ignores invalid stored values and falls back to system preference', () => {
    const result: ResolvedTheme = resolveTheme('invalid', true)
    expect(result).toBe('dark')
  })
})
