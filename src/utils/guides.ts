import { guideRoutes, type GuideRoute, type GuideSource } from '@content/schema'
import { isLocale, type Locale } from '@i18n/index'

import { REPOSITORIES } from './repositories'

export interface GuideLocation {
  locale: Locale
  route: GuideRoute
  slug: string
}

export interface GuideRef extends GuideLocation {
  id: string
  order: number
  draft: boolean
  title: string
}

export interface GuideNeighbors<T> {
  previous: T | undefined
  next: T | undefined
}

const isGuideRoute = (value: string): value is GuideRoute =>
  guideRoutes.some((route) => route === value)

export function parseGuideId(id: string): GuideLocation | undefined {
  const parts = id.split('/')
  if (parts.length !== 3) return undefined
  const [locale, route, slug] = parts
  if (!isLocale(locale) || !isGuideRoute(route) || slug === '') return undefined
  return { locale, route, slug }
}

const ROUTE_PATHS: Record<GuideRoute, string> = {
  mods: 'mods',
  pet: 'mods/pet',
  check: 'mods/check',
  bot: 'bot',
}

export function routeHref(locale: Locale, route: GuideRoute): string {
  return `/${locale}/${ROUTE_PATHS[route]}/`
}

export function guideHref(locale: Locale, route: GuideRoute, slug: string): string {
  return `${routeHref(locale, route)}${slug}/`
}

export function guidesFor<T extends GuideRef>(
  guides: readonly T[],
  locale: Locale,
  route: GuideRoute,
): T[] {
  return guides
    .filter((guide) => guide.locale === locale && guide.route === route && !guide.draft)
    .sort((a, b) => (a.order === b.order ? a.slug.localeCompare(b.slug) : a.order - b.order))
}

export function guideNeighbors<T extends GuideRef>(
  list: readonly T[],
  slug: string,
): GuideNeighbors<T> {
  const index = list.findIndex((guide) => guide.slug === slug)
  if (index === -1) return { previous: undefined, next: undefined }
  return {
    previous: index > 0 ? list[index - 1] : undefined,
    next: index < list.length - 1 ? list[index + 1] : undefined,
  }
}

export function missingTranslations(
  guides: readonly GuideRef[],
  wanted: readonly Locale[],
): string[] {
  const present = new Set(guides.map((guide) => `${guide.locale}/${guide.route}/${guide.slug}`))
  const keys = [...new Set(guides.map((guide) => `${guide.route}/${guide.slug}`))].sort()
  return wanted.flatMap((locale) =>
    keys.map((key) => `${locale}/${key}`).filter((id) => !present.has(id)),
  )
}

const REPOSITORY_NAMES: Record<GuideSource['repo'], string> = {
  pet: 'narsil-pet',
  check: 'narsil-check',
}

export function sourceLabel(source: GuideSource): string {
  return `${REPOSITORY_NAMES[source.repo]}/${source.path}`
}

export function sourceUrl(source: GuideSource): string {
  return `${REPOSITORIES[source.repo]}/blob/main/${source.path}`
}
