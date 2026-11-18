export type Status = 'working' | 'idle' | 'waiting' | 'done' | 'error'

export const STATUSES: readonly Status[] = ['error', 'waiting', 'working', 'done', 'idle']

export const RANK: Record<Status, number> = { error: 0, waiting: 1, working: 2, done: 3, idle: 4 }

export const FLEET_PAGE = 4

export interface Conversation {
  id: string
  status: Status
  minutesAgo: number
}

export interface Fleet {
  ranked: Conversation[]
  wearer: Conversation | undefined
  pages: Conversation[][]
}

export function fleetOf(list: readonly Conversation[], ownId: string): Fleet {
  const ranked = [...list].sort((a, b) => {
    const byRank = RANK[a.status] - RANK[b.status]
    return byRank === 0 ? a.minutesAgo - b.minutesAgo : byRank
  })
  const rows = [...ranked.filter((c) => c.id === ownId), ...ranked.filter((c) => c.id !== ownId)]
  const pageCount = Math.max(1, Math.ceil(rows.length / FLEET_PAGE))
  const pages = Array.from({ length: pageCount }, (_, page) =>
    rows.slice(page * FLEET_PAGE, (page + 1) * FLEET_PAGE),
  )
  return { ranked, wearer: ranked[0], pages }
}
