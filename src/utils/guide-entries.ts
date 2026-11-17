import { type GuideRef, parseGuideId } from './guides'

import type { GuideData } from '@content/schema'

export interface GuideEntryLike {
  id: string
  data: GuideData
}

export interface GuideEntryRef<T extends GuideEntryLike> extends GuideRef {
  entry: T
}

export function toGuideRefs<T extends GuideEntryLike>(
  entries: readonly T[],
): Array<GuideEntryRef<T>> {
  return entries.flatMap((entry) => {
    const location = parseGuideId(entry.id)
    if (location?.route !== entry.data.route) return []
    return [
      {
        ...location,
        id: entry.id,
        order: entry.data.order,
        draft: entry.data.draft,
        title: entry.data.title,
        entry,
      },
    ]
  })
}
