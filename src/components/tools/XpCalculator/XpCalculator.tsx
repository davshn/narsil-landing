import { useState } from 'preact/hooks'

import { growthOf, STAGE_FROM, type Work } from '@/tools/logic/xp'
import { fillTemplate } from '@utils/template'

import '../tool.css'

import type { JSX } from 'preact'

export interface XpCopy {
  turnsLabel: string
  testsLabel: string
  agentsLabel: string
  resultLabel: string
  total: string
  level: string
  stage: string
  nextStage: string
  grown: string
}

interface Props {
  copy: XpCopy
  locale: string
  initial?: Work
}

const FIELDS = ['turns', 'tests', 'agents'] as const

export function XpCalculator({
  copy,
  locale,
  initial = { turns: 30, tests: 10, agents: 5 },
}: Props): JSX.Element {
  const [work, setWork] = useState<Work>(initial)
  const growth = growthOf(work)
  const number = new Intl.NumberFormat(locale)
  const labels = { turns: copy.turnsLabel, tests: copy.testsLabel, agents: copy.agentsLabel }
  const { nextStage: next } = growth

  return (
    <div class="tool" data-tool="xp">
      <div class="tool-fields tool-fields-3">
        {FIELDS.map((field) => (
          <label class="tool-field" key={field}>
            {labels[field]}
            <input
              class="tool-input"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={work[field]}
              onInput={(event) => {
                const {
                  currentTarget: { valueAsNumber: value },
                } = event
                setWork({ ...work, [field]: Number.isNaN(value) ? 0 : value })
              }}
            />
          </label>
        ))}
      </div>
      <output class="tool-result" aria-live="polite">
        <span class="tool-result-label">{copy.resultLabel}</span>
        <span class="tool-result-value">
          {fillTemplate(copy.level, {
            level: growth.level,
            into: number.format(growth.into),
            needed: number.format(growth.needed),
          })}
        </span>
        <span class="tool-result-note">
          {fillTemplate(copy.total, { xp: number.format(growth.xp) })}{' '}
          {fillTemplate(copy.stage, { stage: growth.stage, stages: STAGE_FROM.length })}
        </span>
        <span class="tool-result-note">
          {next === undefined
            ? copy.grown
            : fillTemplate(copy.nextStage, {
                stage: next.stage,
                level: next.level,
                xp: number.format(next.xpLeft),
                turns: number.format(next.turnsLeft),
              })}
        </span>
      </output>
    </div>
  )
}
