import { getCollection } from 'astro:content'

import { type GuideEntryRef, toGuideRefs } from '@utils/guide-entries'
import { guidesFor } from '@utils/guides'

import type { PathKey } from '@i18n/index'

export type GuideEntry = Awaited<ReturnType<typeof getCollection<'guides'>>>[number]
export type GuidePageRef = GuideEntryRef<GuideEntry>

export interface GuidePageProps {
  route: PathKey
  guide: GuidePageRef
  list: GuidePageRef[]
}

export interface GuideStaticPath {
  params: { locale: string; slug: string }
  props: GuidePageProps
}

export async function guideRefs(): Promise<GuidePageRef[]> {
  return toGuideRefs(await getCollection('guides'))
}

export async function guideStaticPaths(route: PathKey): Promise<GuideStaticPath[]> {
  const refs = await guideRefs()
  return refs
    .filter((guide) => guide.route === route && !guide.draft)
    .map((guide) => ({
      params: { locale: guide.locale, slug: guide.slug },
      props: { route, guide, list: guidesFor(refs, guide.locale, route) },
    }))
}
