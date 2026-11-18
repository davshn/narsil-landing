export const NARSIL_POSES = ['hola', 'trabajando', 'necesita', 'terminado', 'error'] as const

export type NarsilPose = (typeof NARSIL_POSES)[number]

export const NARSIL_THEMES = ['claro', 'oscuro'] as const

export type NarsilTheme = (typeof NARSIL_THEMES)[number]

export interface NarsilArt {
  animated: string
  still: string
}

export function narsilArt(pose: NarsilPose, theme: NarsilTheme): NarsilArt {
  const base = `/narsil/${pose}-${theme}`
  return { animated: `${base}.webp`, still: `${base}.png` }
}
