export const OG_IMAGE_KEYS = ['home', 'mods', 'pet', 'check', 'bot', 'tools'] as const

export type OgImageKey = (typeof OG_IMAGE_KEYS)[number]

const SECTIONS: ReadonlyArray<{ prefix: string[]; key: OgImageKey }> = [
  { prefix: ['mods', 'pet'], key: 'pet' },
  { prefix: ['mods', 'check'], key: 'check' },
  { prefix: ['mods'], key: 'mods' },
  { prefix: ['bot'], key: 'bot' },
  { prefix: ['android'], key: 'pet' },
  { prefix: ['watch'], key: 'pet' },
  { prefix: ['tools'], key: 'tools' },
]

export function ogImageKeyFor(pathname: string): OgImageKey {
  const [, ...rest] = pathname.split('/').filter((segment) => segment !== '')
  const section = SECTIONS.find(({ prefix }) =>
    prefix.every((segment, index) => rest[index] === segment),
  )
  return section?.key ?? 'home'
}

export function ogImagePath(pathname: string): string {
  return `/og/${ogImageKeyFor(pathname)}.png`
}
