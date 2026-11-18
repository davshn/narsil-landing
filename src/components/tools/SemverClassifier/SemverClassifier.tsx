import { useState } from 'preact/hooks'

import { classify, type Group } from '@/tools/logic/semver'
import { fillTemplate } from '@utils/template'

import '../tool.css'
import './semver-classifier.css'

import type { JSX } from 'preact'

export interface SemverCopy {
  installedLabel: string
  candidateLabel: string
  resultLabel: string
  groups: Record<Group, string>
  bumps: Record<'patch' | 'minor' | 'major', string>
  summary: string
  belowOne: string
  current: string
  invalidInstalled: string
  invalidCandidate: string
}

interface Props {
  copy: SemverCopy
  installed?: string
  candidate?: string
}

interface Outcome {
  value: string
  note: string
  group?: Group
}

function outcomeOf(copy: SemverCopy, installed: string, candidate: string): Outcome {
  const result = classify(installed, candidate)
  if (result.kind === 'invalid') {
    return {
      value: result.side === 'installed' ? copy.invalidInstalled : copy.invalidCandidate,
      note: '',
    }
  }
  if (result.kind === 'current') {
    return { value: fillTemplate(copy.current, { from: result.from, to: result.to }), note: '' }
  }
  const summary = fillTemplate(copy.summary, {
    from: result.from,
    to: result.to,
    bump: copy.bumps[result.bump],
  })
  return {
    value: copy.groups[result.group],
    note: result.belowOne ? `${summary} ${copy.belowOne}` : summary,
    group: result.group,
  }
}

export function SemverClassifier({
  copy,
  installed: initialInstalled = '0.3.1',
  candidate: initialCandidate = '0.4.0',
}: Props): JSX.Element {
  const [installed, setInstalled] = useState(initialInstalled)
  const [candidate, setCandidate] = useState(initialCandidate)
  const outcome = outcomeOf(copy, installed, candidate)
  const valueClass =
    outcome.group === undefined
      ? 'tool-result-value'
      : `tool-result-value semver-group-${outcome.group}`

  return (
    <div class="tool" data-tool="semver">
      <div class="tool-fields">
        <label class="tool-field">
          {copy.installedLabel}
          <input
            class="tool-input"
            type="text"
            autoComplete="off"
            spellcheck={false}
            value={installed}
            onInput={(event) => {
              setInstalled(event.currentTarget.value)
            }}
          />
        </label>
        <label class="tool-field">
          {copy.candidateLabel}
          <input
            class="tool-input"
            type="text"
            autoComplete="off"
            spellcheck={false}
            value={candidate}
            onInput={(event) => {
              setCandidate(event.currentTarget.value)
            }}
          />
        </label>
      </div>
      <output class="tool-result" aria-live="polite">
        <span class="tool-result-label">{copy.resultLabel}</span>
        <span class={valueClass}>{outcome.value}</span>
        {outcome.note !== '' && <span class="tool-result-note">{outcome.note}</span>}
      </output>
    </div>
  )
}
