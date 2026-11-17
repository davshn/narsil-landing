---
title: Context and limits
description: "How Narsil draws each conversation's context bar, estimates when it fills at the pace of the last 15 minutes, suggests /compact once, and shows the 5-hour and weekly limits."
route: pet
order: 7
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/usage.ts
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## What it does

Two kinds of limits decide how long you can keep working with Claude, and Narsil shows both.

**The context window** is how much of the conversation the model can hold at once. When it fills, Claude Code has to compact the conversation, summarizing what came before, and details can get lost. Each conversation has its own window, so each row in Narsil's band has its own bar and percentage:

```text
● TRABAJANDO   ▾ web                     ██████░░░░ 62 %
```

Your own conversation's bar is blue, so it stands out; the others are green, amber past 60 % and red past 85 %. Pressing the open conversation's percentage shows its tokens, how soon it will fill and what fills it:

- "120k / 200k · lleno en ~20 min" ("full in about 20 minutes").
- A bar per part, as `/context` breaks it down: messages, the system prompt, MCP tools, memory files, the compaction reserve and the free space, each with its tokens.

When the context passes 70 % and will fill within 20 minutes, or as soon as it passes 85 %, Narsil suggests once: "El contexto va al 72 % y se llenará en ~13 min: es buen momento para /compact." ("The context is at 72 % and will fill in about 13 minutes: a good moment for /compact.")

**The account limits** are the 5-hour window and the weekly window of a subscription plan. They are the same for every conversation, so they show once, at the top, with the time until each starts over:

```text
5 horas  ███░░░░░░░ 31 %  reinicia en 2 h 05 min
Semana   █░░░░░░░░░ 12 %  reinicia en 3 d 4 h
```

With an API key there are no such windows, and Narsil shows none.

## How it works inside

### Where the numbers come from

Narsil does not count tokens itself. It reads the figures Claude Code already has, the same ones its status line shows, from two places in the mod API:

- **`$.session.usage()`**, called once in `session.start`. It returns `context` (the live window: `window` in tokens, and `tokens` and `percent` once a response has reported them) and `rateLimits`, one entry per window, each with a `kind` (`five_hour`, `seven_day`), a `percentUsed` and an optional `resetsAt` timestamp.
- **The `session.measure` event**, which, as the 2.1.325 types put it, "fires when the engine measures the session and a unit moved: after each main-thread turn, and when a rate-limit window moves a whole point". It carries the same `context` and `rateLimits`.

Both go through one pure function, `usageOf` in `hooks/usage.ts`, which turns them into Narsil's own shape: `context` (`percent`, `tokens`, `window`), `fiveHour` and `week`. A window with no reading is `null`. The types say `rateLimits` is "empty off a subscription", which is why no limits show with an API key.

Then `setUsage` in `hooks/register.tsx` stores the result in the `usage` atom (only when it changed), records the context reading for the estimate, refreshes the breakdown and pushes the state to the hub, so the other conversations and the floating window see this one's bar.

The design choice is to be pushed, not to poll. The engine raises `session.measure` exactly when a number moved, so Narsil never asks for figures that cannot have changed.

### The estimate: the pace of the last 15 minutes

"Full in about 20 minutes" is a straight-line guess from recent readings. Each time the context is measured, `trackContext` adds a sample, `{ at, percent }`, to a list of at most 30. Then `minutesToFull` in `hooks/usage.ts` does the arithmetic:

1. Keep only the samples of the last 15 minutes (`BURN_WINDOW_MS`).
2. Take the first and the last. If they span less than a minute, or the context did not grow, there is no estimate.
3. The pace is the growth divided by the minutes between them.
4. The answer is the room left divided by the pace, rounded.

For example: 50 % at minute 0 and 60 % at minute 5 is 2 % a minute, and the 40 % left takes 20 minutes.

Each choice has a reason:

- **Fifteen minutes, not the whole conversation.** Work comes in bursts. A long quiet stretch followed by heavy file reading should give a near estimate, not an average that hides the burst.
- **No estimate for less than a minute or a context that is not growing.** Two readings seconds apart, or a context that shrank, give a pace that means nothing.
- **Forget the samples when the context shrinks.** A drop means `/compact` or `/clear` ran. The old pace belongs to a conversation that no longer exists, so the list starts over.
- **Hide estimates past two hours.** `MAX_ESTIMATE_MINUTES` is 120; a guess that far ahead is too far off to be worth showing, as the comment says.

### The `/compact` suggestion, once

`trackContext` also decides the suggestion, with four constants:

- `NUDGE_AT = 70`: never below 70 %.
- `NUDGE_WITHIN_MINUTES = 20`: from 70 %, only if the estimate says it fills within 20 minutes.
- `NUDGE_ALWAYS_AT = 85`: from 85 %, always, estimate or not.
- `NUDGE_RESET_BELOW = 50`: once the context drops below 50 %, a new fill may get a new suggestion.

A flag, `isCompactNudged`, makes it once per fill. The suggestion is one of Narsil's tips (`showTip` with the kind `context`), so it appears where her tips appear, and it is skipped when tips are turned off (`/narsil consejos off`). The reasoning is the same as for every alert in Narsil: a warning that repeats on every turn soon gets ignored.

### The breakdown, estimated locally

What fills the context comes from `$.session.usage({ breakdown: 'summary' })`. The types describe the two modes: `full` "sends one token-count request per tool and memory file, as /context does; `summary` estimates locally and sends none". Narsil uses `summary` and refreshes it whenever a measurement changes the figures, so the breakdown can be opened at once, even for another conversation, whose breakdown travels through the hub.

`contextDetailOf` in `hooks/usage.ts` keeps the parts worth showing: it drops tool schemas loaded on demand (`deferred`, outside the window) and empty rows, sorts what is used by size, then the compaction reserve, then the free space, and gives each a color.

### Drawing the bars

The pieces in `hooks/usage.ts` are small and pure:

- `levelColor(percent)`: green `#22B573`, amber `#F5B400` from 60 %, red `#F0435A` from 85 %.
- `textBar(percent)`: ten cells of `█` and `░`, for the band's rows.
- `minutesLabel` and `resetIn`: "13 min", "2 h 05 min", "3 d 4 h".
- `usageRows`: the rows to draw, each with its note: tokens and the estimate for the context, "reinicia en …" for the limits.
- `usageSvg`: the same rows as one small SVG, used on the desktop, where each bar grows from empty when drawn and the text follows the light or dark theme.

### Why one bar per conversation

The context belongs to a conversation, not to you. A single "context" figure for several conversations would average things that cannot be averaged. That is why the general bar was removed and every row got its own, as the next section records. The account limits are the opposite case: they belong to the account, so they show once.

## How it was asked of the AI

### Recorded: one bar per conversation

The per-conversation bars were asked for in `odd/tasks/fleet-view.md` in narsil-pet, in the same conversation that produced the fleet view (L1 is dated 2026-11-06; the later entries carry no date). L3 (excerpt):

> "la barra de contexto general tambien se iria por que no existe un contexto general y se reemplazaria por las barras de contexto de cada conversacion"

In English: the general context bar would also go, because there is no general context, and it would be replaced by each conversation's context bar. The log's spec S5 adds: "The account limits (5 hours, week) stay, shown once."

The breakdown was asked for in L2 (excerpt):

> "el detalle de como se llena el contexto deberia aparecer cuando se de click en la palabra contexto."

In English: the detail of how the context fills should appear when you click the word "context". L7 records it done in the band. One day later, `250d2c6` (2026-11-07) "feat: open the context from its percent and let next steps stand alone" moved the band's control from the word to the percentage, which is where the README and the code put it today. In the floating window, the word "Contexto" still opens it.

### Reconstruction from the commit history

The bars, the estimate and the suggestion came before that log, and their requests were not recorded. From `git log -- hooks/usage.ts hooks/register.tsx`:

- `630c0d8` (2026-10-30) "feat(usage): add context, 5-hour and weekly usage bars". The first version: one context bar and the two limits.
- `c885292` (2026-10-30) "feat: estimate when the context fills, react to tests and dangerous commands, show subagents". The 15-minute estimate and the `/compact` suggestion.
- `2bcc97c` (2026-11-05) "feat: open the context breakdown from the usage bars and calm loop, steps and permission alerts". The breakdown.
- `49f0fd9` (2026-11-06) "feat: list every open conversation in the band". The bar moves into each conversation's row, as L3 asked.
- `d654e3b` (2026-11-06) "feat: list this conversation first with a blue context bar".
- `250d2c6` (2026-11-07), above.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> In my Claude Code mod `my-pet`, show the context window's fill and the account's 5-hour and weekly limits in the `AbovePrompt` band. Read them once with `$.session.usage()` in `session.start` and then on every `session.measure` event, and keep them in an atom. Write the logic as pure functions in `hooks/usage.ts`: one that maps `context` and `rateLimits` (`five_hour`, `seven_day`) to my own shape, a ten-cell text bar, a color that turns amber at 60 % and red at 85 %, and `minutesToFull(samples, now)`, which estimates when the context fills from the readings of the last 15 minutes and returns null with less than a minute of readings or no growth. Suggest `/compact` once per fill when the context passes 70 % and fills within 20 minutes, or passes 85 %. Add tests for each function and check every API against the plugin-authoring types.

## The minimal code

Written for this guide and checked against the 2.1.325 types (`$.session.usage`, `session.measure`, `SessionContextUsage`, `SessionRateLimit`, `$.clock.now`, `$.ui.toast`). It is adapted from `hooks/usage.ts` and `hooks/register.tsx` in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). The `usage` atom is declared in `types/index.d.ts` as in the first guide.

The pure part, `hooks/usage.ts`:

```ts
import type { SessionContextUsage, SessionRateLimit } from 'claude-code'

export type Meter = { percent: number; resetsAt?: string }
export type Usage = { context: number | null; fiveHour: Meter | null; week: Meter | null }
export type Sample = { at: number; percent: number }

export function usageOf(m: {
  context: SessionContextUsage
  rateLimits: readonly SessionRateLimit[]
}): Usage {
  const meter = (kind: string): Meter | null => {
    const r = m.rateLimits.find((x) => x.kind === kind)
    return r ? { percent: r.percentUsed, resetsAt: r.resetsAt } : null
  }
  return {
    context: m.context.percent ?? null,
    fiveHour: meter('five_hour'),
    week: meter('seven_day'),
  }
}

export const levelColor = (p: number) => (p >= 85 ? '#F0435A' : p >= 60 ? '#F5B400' : '#22B573')

export function textBar(percent: number, cells = 10): string {
  const full = Math.max(0, Math.min(cells, Math.round((percent / 100) * cells)))
  return '█'.repeat(full) + '░'.repeat(cells - full)
}

const WINDOW_MS = 15 * 60_000

export function minutesToFull(samples: readonly Sample[], now: number): number | null {
  const recent = samples.filter((s) => now - s.at <= WINDOW_MS)
  const first = recent[0]
  const last = recent.at(-1)
  if (!first || !last) return null
  const minutes = (last.at - first.at) / 60_000
  if (minutes < 1 || last.percent <= first.percent) return null
  const perMinute = (last.percent - first.percent) / minutes
  return Math.max(0, Math.round((100 - last.percent) / perMinute))
}
```

The hooks, in `hooks/register.tsx`:

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'
import { levelColor, minutesToFull, textBar, usageOf } from './usage'
import type { Sample, Usage } from './usage'

const usage = atom({ plugin: 'my-pet', key: 'usage' } as const, {
  context: null,
  fiveHour: null,
  week: null,
})
let samples: Sample[] = []
let isNudged = false

async function track($: EngineInterface, next: Usage): Promise<void> {
  await update($, usage, () => next)
  const percent = next.context
  if (percent === null) return
  const now = await $.clock.now()
  const last = samples.at(-1)
  if (last && percent < last.percent) samples = []
  if (percent < 50) isNudged = false
  samples = [...samples, { at: now, percent }].slice(-30)
  const toFull = minutesToFull(samples, now)
  const isNear = toFull !== null && toFull <= 20
  if (isNudged || percent < 70 || !(isNear || percent >= 85)) return
  isNudged = true
  $.ui.toast(`Context at ${Math.round(percent)} %: a good moment for /compact.`)
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    const spent = await $.session.usage().catch(() => undefined)
    if (spent) await track($, usageOf(spent))
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await track($, usageOf(e))
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const u = await read($, usage)
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column" minWidth={0}>
        {u.context !== null ? (
          <Text
            color={levelColor(u.context)}
          >{`Context ${textBar(u.context)} ${Math.round(u.context)} %`}</Text>
        ) : null}
        {u.fiveHour ? (
          <Text>{`5 hours ${textBar(u.fiveHour.percent)} ${Math.round(u.fiveHour.percent)} %`}</Text>
        ) : null}
        {u.week ? (
          <Text>{`Week ${textBar(u.week.percent)} ${Math.round(u.week.percent)} %`}</Text>
        ) : null}
      </Box>
    )
  })
}
```

Narsil shows the suggestion as one of its tips; a minimal version can use `$.ui.toast`, as here.

## Common mistakes and how to test it

- **Polling for figures.** A timer that calls `$.session.usage()` every few seconds does work that `session.measure` already does for you, at the moment a number moves.
- **Assuming the limits exist.** Off a subscription, `rateLimits` is empty. Draw nothing then, rather than a bar at 0 %.
- **A context with no percentage yet.** Before the first response, `percent` and `tokens` may be absent. Narsil treats a missing `percent` as "no reading".
- **Keeping the old pace after `/compact`.** If the samples are not cleared when the context shrinks, the estimate mixes two conversations and says nonsense.
- **A suggestion on every turn.** Without a flag that resets only when the context drops, the same `/compact` advice comes back at 71, 72 and 73 %.
- **Asking for the `full` breakdown on every measurement.** `full` sends token-count requests; `summary` is local and free.

To test, `claude plugin test .` runs `tests/narsil.test.tsx`. "the context bar tells when it will fill, and Narsil suggests /compact once when it is near" measures 50 % and, five minutes later, 60 %, then checks the text "120k / 200k · lleno en ~20 min"; it then measures 72 % at minute 10 and 74 % at minute 11 and checks that exactly one suggestion went out, "El contexto va al 72 % y se llenará en ~13 min: es buen momento para /compact.". "a context that is not growing shows no estimate and no nudge" covers a context that shrinks. "the band shows the 5-hour window and the week once, and the context in its conversation", "off a plan, no limits show, and the context is read when the session starts" and "a press on the open conversation percent shows what fills the context, and another goes back to the bars" cover the rest. The functions in `hooks/usage.ts` take plain values, so they can also be tested directly with a list of samples and a fixed `now`.

## Going further

- `contextDetailOf`, `contextDetailRows` and `contextDetailSvg` in `hooks/usage.ts` turn the `/context` breakdown into bars.
- `usageSummary` and `contextDetailSummary` give one sentence for places that cannot draw bars.
- `toggleContextDetail` in `hooks/register.tsx` reads this conversation's breakdown afresh when you open it, and shows a toast if it cannot.
- `shownState` sends each conversation's `context` (its percent and note) and `contextDetail` to the hub, which is how another conversation's band and the floating window draw a bar they did not measure.
