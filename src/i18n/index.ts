export const locales = ['en', 'es', 'it', 'fr', 'pt'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'en'

export const ogLocales: Record<Locale, string> = {
  en: 'en_US',
  es: 'es_ES',
  it: 'it_IT',
  fr: 'fr_FR',
  pt: 'pt_BR',
}

export const languageTags: Record<Locale, string> = {
  en: 'en',
  es: 'es',
  it: 'it',
  fr: 'fr',
  pt: 'pt-BR',
}

export const localeNames: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  it: 'Italiano',
  fr: 'Français',
  pt: 'Português (Brasil)',
}

export function isLocale(value: string): value is Locale {
  return locales.some((l) => l === value)
}

export interface RouteCopy {
  title: string
  description: string
  icon: string
}

export interface PathCopy {
  title: string
  description: string
  intro: [string, string]
  listTitle: string
  startCta: string
}

export const pathKeys = ['mods', 'pet'] as const
export type PathKey = (typeof pathKeys)[number]

export interface TranslationShape {
  meta: {
    siteName: string
    title: string
    description: string
  }
  common: {
    skipToContent: string
    toggleTheme: string
    language: string
    mainNavigation: string
  }
  nav: {
    mods: string
    routes: string
    support: string
  }
  footer: {
    description: string
    donate: string
    trademark: string
    privacy: string
  }
  home: {
    headline: string
    subheadline: string
    cta: string
    fundamentalsCta: string
    aboutTitle: string
    about: [string, string]
    routesTitle: string
    routesSubtitle: string
    routes: [RouteCopy, RouteCopy, RouteCopy]
    coffeeTitle: string
    coffeeText: string
    coffeeCta: string
    extension: {
      badge: string
      title: string
      text: string
      note: string
    }
  }
  mods: PathCopy
  pet: PathCopy
  guide: {
    breadcrumbLabel: string
    stepOf: string
    updated: string
    verifiedWith: string
    sourcesTitle: string
    sourcesIntro: string
    pathNavLabel: string
    previous: string
    next: string
    backToPath: string
    coffeeTitle: string
    coffeeText: string
    coffeeCta: string
  }
  support: {
    title: string
    description: string
    lines: [string, string, string]
    donate: string
    unavailable: string
    reposTitle: string
    repos: {
      pet: string
      check: string
    }
    developer: {
      text: string
      link: string
    }
  }
}
