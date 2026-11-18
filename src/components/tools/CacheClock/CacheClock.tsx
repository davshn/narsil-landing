import { useState } from 'preact/hooks'

import { cacheMinutesFor, cacheState, type Account } from '@/tools/logic/cache'
import { fillTemplate } from '@utils/template'

import '../tool.css'
import './cache-clock.css'

import type { JSX } from 'preact'

export interface CacheCopy {
  accountLabel: string
  accounts: Record<Account, string>
  customLabel: string
  elapsedLabel: string
  resultLabel: string
  lasts: string
  warm: string
  cold: string
}

interface Props {
  copy: CacheCopy
}

const ACCOUNTS: readonly Account[] = ['plan', 'api', 'custom']

const numberOf = (value: number): number => (Number.isNaN(value) ? 0 : value)

export function CacheClock({ copy }: Props): JSX.Element {
  const [account, setAccount] = useState<Account>('api')
  const [custom, setCustom] = useState(30)
  const [elapsed, setElapsed] = useState(3)
  const minutes = cacheMinutesFor(account, custom)
  const state = cacheState(minutes, elapsed)

  return (
    <div class="tool" data-tool="cache">
      <fieldset class="cache-accounts">
        <legend class="tool-field">{copy.accountLabel}</legend>
        {ACCOUNTS.map((option) => (
          <label class="cache-account" key={option}>
            <input
              type="radio"
              name="cache-account"
              value={option}
              checked={account === option}
              onChange={() => {
                setAccount(option)
              }}
            />
            {copy.accounts[option]}
          </label>
        ))}
      </fieldset>
      <div class="tool-fields">
        {account === 'custom' && (
          <label class="tool-field">
            {copy.customLabel}
            <input
              class="tool-input"
              type="number"
              min="1"
              max="1440"
              step="1"
              inputMode="numeric"
              value={custom}
              onInput={(event) => {
                const {
                  currentTarget: { valueAsNumber: value },
                } = event
                setCustom(numberOf(value))
              }}
            />
          </label>
        )}
        <label class="tool-field">
          {copy.elapsedLabel}
          <input
            class="tool-input"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={elapsed}
            onInput={(event) => {
              const {
                currentTarget: { valueAsNumber: value },
              } = event
              setElapsed(numberOf(value))
            }}
          />
        </label>
      </div>
      <output class="tool-result" aria-live="polite">
        <span class="tool-result-label">{copy.resultLabel}</span>
        <span class={`tool-result-value cache-${state.kind}`}>
          {state.kind === 'warm' ? fillTemplate(copy.warm, { left: state.left }) : copy.cold}
        </span>
        <span class="tool-result-note">{fillTemplate(copy.lasts, { minutes })}</span>
      </output>
    </div>
  )
}
