import { resolveTheme, STORAGE_KEY } from '@utils/theme-mode'

const CYCLE = ['system', 'light', 'dark'] as const
const DARK_QUERY = '(prefers-color-scheme: dark)'

function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStored(mode: string): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode)
    return true
  } catch {
    return false
  }
}

function currentMode(): string {
  const stored = readStored()
  return stored === null || stored === '' ? 'system' : stored
}

function nextMode(current: string): string {
  const index = CYCLE.findIndex((mode) => mode === current)
  return CYCLE[(index + 1) % CYCLE.length]
}

function applyTheme(mode: string): void {
  const isDark = resolveTheme(mode, window.matchMedia(DARK_QUERY).matches) === 'dark'
  document.documentElement.classList.toggle('dark', isDark)
}

function initThemeToggle(): void {
  const button = document.getElementById('theme-toggle')
  if (button === null) return

  button.addEventListener('click', () => {
    const next = nextMode(currentMode())
    writeStored(next)
    applyTheme(next)
  })

  window.matchMedia(DARK_QUERY).addEventListener('change', () => {
    if (currentMode() === 'system') applyTheme('system')
  })
}

if (typeof document !== 'undefined') {
  initThemeToggle()
}
