import { describe, expect, it } from 'vitest'

import { NARSIL_POSES, NARSIL_THEMES, narsilArt, type NarsilPose } from '../narsil-art'

const animatedPathsOf = (pose: NarsilPose): string[] =>
  NARSIL_THEMES.map((theme) => narsilArt(pose, theme).animated)

describe('narsilArt', () => {
  it('points to the animated loop and the still drawing of a pose and theme', () => {
    expect(narsilArt('hola', 'oscuro')).toEqual({
      animated: '/narsil/hola-oscuro.webp',
      still: '/narsil/hola-oscuro.png',
    })
  })

  it('gives every pose and theme its own pair of files', () => {
    const paths = NARSIL_POSES.flatMap(animatedPathsOf)

    expect(new Set(paths).size).toBe(NARSIL_POSES.length * NARSIL_THEMES.length)
  })
})
