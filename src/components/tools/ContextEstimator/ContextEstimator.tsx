import { useState } from 'preact/hooks'

import { estimateFill, type Estimate, type Readings } from '@/tools/logic/context'
import { fillTemplate } from '@utils/template'

import '../tool.css'

import type { JSX } from 'preact'

export interface ContextCopy {
  earlierLabel: string
  nowLabel: string
  minutesLabel: string
  resultLabel: string
  estimate: string
  far: string
  full: string
  old: string
  short: string
  flat: string
}

interface Props {
  copy: ContextCopy
  initial?: Readings
}

const FIELDS = [
  { key: 'earlier', max: 100 },
  { key: 'now', max: 100 },
  { key: 'minutes', max: 60 },
] as const

function messageOf(copy: ContextCopy, estimate: Estimate): string {
  if (estimate.kind === 'estimate')
    return fillTemplate(copy.estimate, { minutes: estimate.minutes })
  return copy[estimate.kind]
}

export function ContextEstimator({
  copy,
  initial = { earlier: 40, now: 50, minutes: 5 },
}: Props): JSX.Element {
  const [readings, setReadings] = useState<Readings>(initial)
  const labels = { earlier: copy.earlierLabel, now: copy.nowLabel, minutes: copy.minutesLabel }

  return (
    <div class="tool" data-tool="context">
      <div class="tool-fields tool-fields-3">
        {FIELDS.map(({ key, max }) => (
          <label class="tool-field" key={key}>
            {labels[key]}
            <input
              class="tool-input"
              type="number"
              min="0"
              max={max}
              step="1"
              inputMode="numeric"
              value={readings[key]}
              onInput={(event) => {
                const {
                  currentTarget: { valueAsNumber: value },
                } = event
                setReadings({ ...readings, [key]: Number.isNaN(value) ? 0 : value })
              }}
            />
          </label>
        ))}
      </div>
      <output class="tool-result" aria-live="polite">
        <span class="tool-result-label">{copy.resultLabel}</span>
        <span class="tool-result-value">{messageOf(copy, estimateFill(readings))}</span>
      </output>
    </div>
  )
}
