export const locales = ['en', 'es'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'en'

export const ogLocales: Record<Locale, string> = {
  en: 'en_US',
  es: 'es_ES',
}

export function isLocale(value: string): value is Locale {
  return locales.some((l) => l === value)
}

export interface TranslationShape {
  meta: {
    siteName: string
    title: string
    description: string
  }
  hero: {
    headline: string
    subheadline: string
    cta: string
  }
  sidebar: {
    title: string
    subtitle: string
    components: string
    sections: string
  }
  nav: {
    button: string
    input: string
    select: string
    dropdown: string
    text: string
    avatar: string
    container: string
    sidebar: string
    alert: string
    badge: string
    progress: string
    separator: string
    checkbox: string
    radio: string
    accordion: string
    tooltip: string
    toast: string
    carousel: string
    timeline: string
    modal: string
    table: string
    card: string
    header: string
    footer: string
    pricing: string
    cta: string
    hero: string
    contact: string
    features: string
    faq: string
  }
  descriptions: {
    button: string
    input: string
    select: string
    dropdown: string
    text: string
    avatar: string
    container: string
    sidebar: string
    alert: string
    badge: string
    progress: string
    separator: string
    checkbox: string
    radio: string
    accordion: string
    tooltip: string
    toast: string
    carousel: string
    timeline: string
    modal: string
    table: string
    card: string
    header: string
    footer: string
    pricing: string
    cta: string
    hero: string
    contact: string
    features: string
    faq: string
  }
}
