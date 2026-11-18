export const XP_GAIN = {
  turn: 10,
  tests: 5,
  agent: 3,
} as const

const PER_LEVEL = 100

export const STAGE_FROM = [1, 5, 10, 20, 35] as const

export interface Level {
  level: number
  into: number
  needed: number
}

export interface Work {
  turns: number
  tests: number
  agents: number
}

export interface Growth extends Level {
  xp: number
  stage: number
  nextStage?: { stage: number; level: number; xpLeft: number; turnsLeft: number }
}

export function levelOf(xp: number): Level {
  let level = 1
  let left = Math.max(0, Math.floor(xp))
  while (left >= level * PER_LEVEL) {
    left -= level * PER_LEVEL
    level += 1
  }
  return { level, into: left, needed: level * PER_LEVEL }
}

export function stageOf(level: number): number {
  return Math.max(1, STAGE_FROM.filter((from) => level >= from).length)
}

export function xpToReach(level: number): number {
  const below = Math.max(0, level - 1)
  return (PER_LEVEL * below * (below + 1)) / 2
}

const count = (value: number): number =>
  Number.isFinite(value) && value > 0 ? Math.floor(value) : 0

export function growthOf(work: Work): Growth {
  const xp =
    count(work.turns) * XP_GAIN.turn +
    count(work.tests) * XP_GAIN.tests +
    count(work.agents) * XP_GAIN.agent
  const level = levelOf(xp)
  const stage = stageOf(level.level)
  const nextLevel = STAGE_FROM.at(stage)
  if (nextLevel === undefined) return { xp, ...level, stage, nextStage: undefined }
  const xpLeft = xpToReach(nextLevel) - xp
  return {
    xp,
    ...level,
    stage,
    nextStage: {
      stage: stage + 1,
      level: nextLevel,
      xpLeft,
      turnsLeft: Math.ceil(xpLeft / XP_GAIN.turn),
    },
  }
}
