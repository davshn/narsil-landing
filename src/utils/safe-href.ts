const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:'])
const SCHEME = /^(?<scheme>[a-z][a-z\d+.\-]*:)/iv
const IGNORED_BY_BROWSERS = /[\s\p{Cc}]/gv

export function safeHref(href: string | undefined): string | undefined {
  if (href === undefined) return undefined
  const compact = href.replace(IGNORED_BY_BROWSERS, '')
  if (compact === '') return undefined
  const scheme = SCHEME.exec(compact)?.groups?.scheme
  if (scheme !== undefined) return SAFE_SCHEMES.has(scheme.toLowerCase()) ? href : undefined
  if (compact.startsWith('//') || compact.startsWith('\\') || compact.startsWith('/\\'))
    return undefined
  return href
}
