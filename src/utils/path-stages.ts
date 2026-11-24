import type { PathKey } from '@i18n/index'

export const PATH_STAGE_STARTS: Record<PathKey, readonly string[]> = {
  mods: ['what-is-a-mod', 'the-dollar-object', 'install-and-test', 'surfaces', 'license'],
  pet: [
    'states',
    'every-conversation',
    'floating-window',
    'context-and-limits',
    'command-reactions',
    'next-steps',
    'phone-and-watch',
  ],
  check: [
    'side-panel',
    'session-environment',
    'ecosystems',
    'explain-major',
    'vulnerabilities',
    'kotlin-gradle-agp',
  ],
  bot: [
    'the-bot',
    'xiaozhi-belly',
    'own-server',
    'ntfy-alerts',
    'belly-ui',
    'uart-protocol',
    'secrets-privacy',
  ],
  android: ['what-it-is', 'webview-host', 'conversation-band', 'colors-and-mode', 'alerts-service'],
  watch: ['what-it-is', 'reading-the-state', 'tile', 'app-and-refresh'],
}

export const botParts = ['head', 'belly', 'feeds', 'server', 'claude'] as const
export type BotPart = (typeof botParts)[number]

export const BOT_PART_GUIDES: Record<BotPart, readonly string[]> = {
  head: ['holographic-head'],
  belly: ['xiaozhi-belly', 'belly-ui', 'uart-protocol', 'secrets-privacy'],
  feeds: ['ntfy-alerts', 'github-prs'],
  server: ['own-server', 'narsil-voice'],
  claude: ['claude-brain'],
}

export function groupStages<T extends { slug: string }>(
  guides: readonly T[],
  starts: readonly string[],
): T[][] {
  const positions = starts.map((start) => guides.findIndex((guide) => guide.slug === start))
  return positions.map((position, index) => {
    if (position === -1) return []
    const later = positions.slice(index + 1).filter((next) => next > position)
    const end = later.length > 0 ? Math.min(...later) : guides.length
    return guides.slice(position, end)
  })
}

export interface NumberedGuide {
  number: number
  title: string
  href: string
}

export type SluggedGuide = NumberedGuide & { slug: string }

export function pickGuides(
  guides: readonly SluggedGuide[],
  slugs: readonly string[],
): NumberedGuide[] {
  return guides
    .filter((guide) => slugs.includes(guide.slug))
    .map(({ number, title, href }) => ({ number, title, href }))
}

export function botPartGuides(guides: readonly SluggedGuide[]): Record<BotPart, NumberedGuide[]> {
  return {
    head: pickGuides(guides, BOT_PART_GUIDES.head),
    belly: pickGuides(guides, BOT_PART_GUIDES.belly),
    feeds: pickGuides(guides, BOT_PART_GUIDES.feeds),
    server: pickGuides(guides, BOT_PART_GUIDES.server),
    claude: pickGuides(guides, BOT_PART_GUIDES.claude),
  }
}
