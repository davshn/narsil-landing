import { useState } from 'preact/hooks'

import {
  BOT_EFFORTS,
  BOT_MODELS,
  botConfig,
  DEFAULT_BOT_OPTIONS,
  type BotEffort,
  type BotModel,
  type BotOptions,
} from '@utils/bot-config'

import '../tool.css'
import './bot-config.css'

import type { JSX } from 'preact'

export interface BotConfigCopy {
  hostLabel: string
  timezoneLabel: string
  modelLabel: string
  models: Record<BotModel, string>
  effortLabel: string
  efforts: Record<BotEffort, string>
  maxTokensLabel: string
  voiceLabel: string
  resultLabel: string
  invalid: Record<keyof BotOptions, string>
  copy: string
  copied: string
  keyNote: string
}

interface Props {
  copy: BotConfigCopy
}

const numberOf = (value: number): number => (Number.isNaN(value) ? 0 : value)

export function BotConfigGenerator({ copy }: Props): JSX.Element {
  const [options, setOptions] = useState<BotOptions>(DEFAULT_BOT_OPTIONS)
  const [copiedYaml, setCopiedYaml] = useState('')
  const result = botConfig(options)
  const set = (change: Partial<BotOptions>): void => {
    setOptions({ ...options, ...change })
  }

  return (
    <div class="tool" data-tool="bot-config">
      <div class="tool-fields">
        <label class="tool-field">
          {copy.hostLabel}
          <input
            class="tool-input"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            spellcheck={false}
            value={options.host}
            onInput={(event) => {
              set({ host: event.currentTarget.value })
            }}
          />
        </label>
        <label class="tool-field">
          {copy.timezoneLabel}
          <input
            class="tool-input"
            type="number"
            min="-12"
            max="14"
            step="1"
            value={options.timezone}
            onInput={(event) => {
              const {
                currentTarget: { valueAsNumber: value },
              } = event
              set({ timezone: numberOf(value) })
            }}
          />
        </label>
        <label class="tool-field">
          {copy.modelLabel}
          <select
            class="tool-input"
            value={options.model}
            onChange={(event) => {
              const model = BOT_MODELS.find((m) => m === event.currentTarget.value)
              if (model !== undefined) set({ model })
            }}
          >
            {BOT_MODELS.map((model) => (
              <option value={model} key={model}>
                {copy.models[model]}
              </option>
            ))}
          </select>
        </label>
        <label class="tool-field">
          {copy.effortLabel}
          <select
            class="tool-input"
            value={options.effort}
            onChange={(event) => {
              const effort = BOT_EFFORTS.find((e) => e === event.currentTarget.value)
              if (effort !== undefined) set({ effort })
            }}
          >
            {BOT_EFFORTS.map((effort) => (
              <option value={effort} key={effort}>
                {copy.efforts[effort]}
              </option>
            ))}
          </select>
        </label>
        <label class="tool-field">
          {copy.maxTokensLabel}
          <input
            class="tool-input"
            type="number"
            min="1"
            max="128000"
            step="1"
            value={options.maxTokens}
            onInput={(event) => {
              const {
                currentTarget: { valueAsNumber: value },
              } = event
              set({ maxTokens: numberOf(value) })
            }}
          />
        </label>
        <label class="tool-field">
          {copy.voiceLabel}
          <input
            class="tool-input"
            type="text"
            autoComplete="off"
            spellcheck={false}
            value={options.voice}
            onInput={(event) => {
              set({ voice: event.currentTarget.value })
            }}
          />
        </label>
      </div>
      <div class="tool-result" data-bot-config-result>
        <span class="tool-result-label" id="bot-config-label">
          {copy.resultLabel}
        </span>
        <span class="tool-result-value bot-config-invalid" role="status">
          {result.kind === 'invalid' ? copy.invalid[result.field] : ''}
        </span>
        {result.kind === 'ok' && (
          <>
            <pre class="bot-config-yaml" tabIndex={0} aria-labelledby="bot-config-label">
              <code>{result.yaml}</code>
            </pre>
            <button
              type="button"
              class="bot-config-copy"
              onClick={() => {
                navigator.clipboard
                  .writeText(result.yaml)
                  .then(() => {
                    setCopiedYaml(result.yaml)
                  })
                  .catch(() => {
                    setCopiedYaml('')
                  })
              }}
            >
              {copiedYaml === result.yaml ? copy.copied : copy.copy}
            </button>
          </>
        )}
        <span class="tool-result-note">{copy.keyNote}</span>
      </div>
    </div>
  )
}
