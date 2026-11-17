export function buildAlternateUrl(
  currentPathname: string,
  targetLocale: string,
  site: URL,
  locales: readonly string[],
): string {
  const parts = currentPathname.split('/').filter(Boolean)
  if (parts.length > 0 && locales.includes(parts[0] ?? '')) {
    parts[0] = targetLocale
  } else {
    parts.unshift(targetLocale)
  }
  return new URL(`/${parts.join('/')}/`, site).href
}
