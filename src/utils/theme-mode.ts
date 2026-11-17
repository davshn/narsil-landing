export const THEME_MODES = ['light', 'dark', 'system'] as const
export type ThemeMode = (typeof THEME_MODES)[number]
export type ResolvedTheme = 'light' | 'dark'

export const STORAGE_KEY = 'theme'

export function resolveTheme(stored: string | null, systemPrefersDark: boolean): ResolvedTheme {
  if (stored === 'dark') return 'dark'
  if (stored === 'light') return 'light'
  return systemPrefersDark ? 'dark' : 'light'
}
