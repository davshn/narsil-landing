import { defaultLocale, isLocale, type Locale, type TranslationShape } from './index'
import { en } from './locales/en'
import { es } from './locales/es'

const translations: Record<Locale, TranslationShape> = { en, es }

export function useTranslations(locale: Locale): TranslationShape {
  return translations[locale]
}

export function getLocaleFromUrl(url: URL): Locale {
  const segments = url.pathname.split('/').filter((s) => s !== '')
  const first = segments[0] ?? ''
  return isLocale(first) ? first : defaultLocale
}
