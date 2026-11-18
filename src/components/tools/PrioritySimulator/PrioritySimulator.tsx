import { useState } from 'preact/hooks'

import { fleetOf, STATUSES, type Conversation, type Status } from '@/tools/logic/fleet'
import { fillTemplate } from '@utils/template'

import '../tool.css'
import './priority-simulator.css'

import type { JSX } from 'preact'

export interface PriorityCopy {
  statuses: Record<Status, string>
  own: string
  other: string
  statusLabel: string
  minutesLabel: string
  add: string
  remove: string
  wearsLabel: string
  wears: string
  rowsLabel: string
  page: string
}

interface Props {
  copy: PriorityCopy
  initial?: Conversation[]
}

const OWN_ID = 'c1'
const MAX_CONVERSATIONS = 8

const EXAMPLE: Conversation[] = [
  { id: OWN_ID, status: 'working', minutesAgo: 1 },
  { id: 'c2', status: 'done', minutesAgo: 4 },
  { id: 'c3', status: 'waiting', minutesAgo: 12 },
]

function nameOf(copy: PriorityCopy, list: readonly Conversation[], id: string): string {
  if (id === OWN_ID) return copy.own
  return fillTemplate(copy.other, { n: list.findIndex((c) => c.id === id) + 1 })
}

function nextId(list: readonly Conversation[]): string {
  const used = new Set(list.map((c) => c.id))
  const free = Array.from({ length: MAX_CONVERSATIONS }, (_, n) => `c${n + 1}`).find(
    (id) => !used.has(id),
  )
  return free ?? `c${list.length + 1}`
}

export function PrioritySimulator({ copy, initial = EXAMPLE }: Props): JSX.Element {
  const [list, setList] = useState<Conversation[]>(initial)
  const fleet = fleetOf(list, OWN_ID)
  const update = (id: string, change: Partial<Conversation>): void => {
    setList(list.map((c) => (c.id === id ? { ...c, ...change } : c)))
  }

  return (
    <div class="tool" data-tool="priority">
      <ul class="priority-list">
        {list.map((conversation) => {
          const name = nameOf(copy, list, conversation.id)
          return (
            <li class="priority-item" key={conversation.id}>
              <fieldset class="priority-fieldset">
                <legend class="priority-name">{name}</legend>
                <div class="tool-fields">
                  <label class="tool-field">
                    {copy.statusLabel}
                    <select
                      class="tool-input"
                      value={conversation.status}
                      onChange={(event) => {
                        const status = STATUSES.find((s) => s === event.currentTarget.value)
                        if (status !== undefined) update(conversation.id, { status })
                      }}
                    >
                      {STATUSES.map((status) => (
                        <option value={status} key={status}>
                          {copy.statuses[status]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label class="tool-field">
                    {copy.minutesLabel}
                    <input
                      class="tool-input"
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      value={conversation.minutesAgo}
                      onInput={(event) => {
                        const {
                          currentTarget: { valueAsNumber: value },
                        } = event
                        update(conversation.id, {
                          minutesAgo: Number.isNaN(value) ? 0 : Math.max(0, value),
                        })
                      }}
                    />
                  </label>
                </div>
                {conversation.id !== OWN_ID && (
                  <button
                    type="button"
                    class="priority-remove"
                    onClick={() => {
                      setList(list.filter((c) => c.id !== conversation.id))
                    }}
                  >
                    {fillTemplate(copy.remove, { name })}
                  </button>
                )}
              </fieldset>
            </li>
          )
        })}
      </ul>
      <button
        type="button"
        class="priority-add"
        disabled={list.length >= MAX_CONVERSATIONS}
        onClick={() => {
          setList([...list, { id: nextId(list), status: 'idle', minutesAgo: 0 }])
        }}
      >
        {copy.add}
      </button>
      <output class="tool-result" aria-live="polite">
        <span class="tool-result-label">{copy.wearsLabel}</span>
        {fleet.wearer !== undefined && (
          <span class="tool-result-value">
            {fillTemplate(copy.wears, {
              name: nameOf(copy, list, fleet.wearer.id),
              status: copy.statuses[fleet.wearer.status],
            })}
          </span>
        )}
        <span class="tool-result-label">{copy.rowsLabel}</span>
        {fleet.pages.map((page, index) => (
          <div class="priority-page" key={index}>
            <span class="tool-result-note">{fillTemplate(copy.page, { page: index + 1 })}</span>
            <ol class="priority-rows">
              {page.map((conversation) => (
                <li key={conversation.id}>
                  {`${nameOf(copy, list, conversation.id)} · ${copy.statuses[conversation.status]}`}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </output>
    </div>
  )
}
