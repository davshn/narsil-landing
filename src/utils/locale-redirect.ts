import { serializeForInlineScript } from './inline-json'

export function buildLocaleRedirectScript(
  locales: readonly string[],
  defaultLocale: string,
): string {
  const localeList = serializeForInlineScript([...locales])
  const fallback = serializeForInlineScript(defaultLocale)
  return `(function(){var locales=${localeList};var lang=navigator.language.split('-')[0];var locale=locales.indexOf(lang)>=0?lang:${fallback};window.location.replace('/'+locale+'/')})()`
}
