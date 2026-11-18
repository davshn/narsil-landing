---
title: The cache clock
description: 'How Narsil counts down the prompt cache from the start of the last request, 60 minutes on a subscription and 5 with an API key, and why the next turn costs more once it goes cold.'
route: pet
order: 8
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: hooks/usage.ts
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## What it does

When a turn ends and Claude waits for you, Narsil shows a small clock in the conversation's row:

```text
🧊 Caché: 42 min
```

It counts down, minute by minute, how long the prompt cache of this conversation is expected to last. When it reaches zero it says so: in the band, "🧊 Caché fría" ("cold cache"), and in the floating window and the hub, the full sentence "🧊 Caché fría: el próximo mensaje se cobra completo" ("cold cache: the next message is billed in full"). When you send the next prompt the clock goes away, since Claude is working again, and a new one starts when that turn ends.

Why it matters to you: each message you send makes Claude read the whole conversation again. The prompt cache keeps the part already sent, so a reply within its lifetime reuses it. As the README puts it, the message is then cheaper; once the cache has lapsed, the next message is billed in full, and the conversation has to be written to the cache again. The 2.1.325 types describe that rewrite, in another context, as "waited for, the longer the conversation the longer". So the clock answers a practical question: if you come back to this conversation now, is it still warm?

The clock assumes 60 minutes on a subscription plan and 5 minutes with an API key. `/narsil cache` says how long it is counting; `/narsil cache 30` sets it by hand, and `/narsil cache auto` goes back to deciding from your account.

Every conversation's row shows its own clock, so you can see which conversations are still warm before you pick one up.

## How it works inside

### Not a timer: a value and a heartbeat

The clock is one atom, `cache`, in `hooks/register.tsx`. It holds four numbers:

- `at`: when the turn ended.
- `requestAt`: when the turn's last model request started.
- `minutes`: how long the cache lasts.
- `left`: the whole minutes left, as shown.

Nothing counts down by itself. On every two-second heartbeat, `tickCache` recomputes `left` with `cacheLeft` from `hooks/words.ts`:

```ts
export function cacheLeft(at: number, minutes: number, now: number): number {
  return Math.max(0, Math.ceil((at + minutes * 60_000 - now) / 60_000))
}
```

It writes the atom only when the number of minutes changed, so the band redraws once a minute, not every two seconds. Rounding up means that "1 min" stays until the last second has passed, and zero means it is really gone.

### When it starts and stops

Three events drive it:

- **`turn.step`** fires when the engine is about to send a model request. For the main conversation (`e.agentId === undefined`), Narsil records the time in `lastRequestAt`. A subagent's requests are left out: as the comment says, a subagent's requests have a cache of their own.
- **`turn.complete`** for the main conversation calls `startCache`, which writes the atom with `at` set to now and `requestAt` set to `lastRequestAt`.
- **`turn.start`** clears the atom: while Claude works, there is no clock.

### Why from the start of the last request

The clock counts from when the last request started, not from when the turn ended. The helper `cacheStart` says why in its comment: "the API counts it from the start of the request that last read or wrote it". A long answer that took three minutes to write has already spent three of the cache's minutes by the time the turn ends.

This was a fix, `c3e4464`, and the test that pins it reads like the explanation: with a five-minute cache and three minutes spent while the model answered, the band shows "🧊 Caché: 2 min" at the end of the turn, not five.

The next steps that Narsil offers after a quiet turn still count from the end of the turn (`at`): they are about you being away, not about the cache.

### Deciding between 60 and 5 minutes

How long the cache lasts is not something the mod can read. The comment above the constants says so:

```tsx
// How long the prompt cache lasts, in minutes: on a plan Claude Code keeps it
// an hour, with an API key five minutes. The API does not say which: a
// person who knows better sets it with /narsil cache.
const PLAN_CACHE_MINUTES = 60
const API_CACHE_MINUTES = 5
```

So `cacheMinutes` decides in two steps:

1. If you set a number with `/narsil cache <min>`, that number.
2. Otherwise, whether the account has rate-limit windows. If the `usage` atom (the previous guide) holds a 5-hour or a weekly reading, it is a subscription and the cache gets 60 minutes; if not, it is an API key and the cache gets 5.

The second step leans on what the 2.1.325 types say about `rateLimits`: "empty off a subscription". The decision is taken when the turn ends, from whatever the `usage` atom holds at that moment.

The numbers 60 and 5 are the mod's assumption, stated in its code and README, not a figure Claude Code reports. The manual setting exists because the author knew the assumption could be wrong for someone's setup. A new setting also recomputes the clock already running.

### What it draws, and where

The text comes from `cacheLabel` in `hooks/words.ts`: "🧊 Caché: N min" while warm, the cold sentence at zero. `cacheShort` cuts the cold sentence to "🧊 Caché fría" for the band's rows, which have little room; the floating window shows the label in full when you open a conversation.

Each conversation also sends the hub `cacheEndsAt`, the moment its cache runs out in seconds, and `cacheMinutes`. With those, the other conversations, the floating window and the phone can count down a clock they did not start.

The README says the clock is green while fresh and red when about to expire, and `hooks/words.ts` has a `cacheColor` for it, based on how much of the cache's life is spent. In the current code `hooks/register.tsx` imports `cacheColor` but never calls it: the band draws the clock as dimmed text, and the floating window as a plain note. If you build your own, the color is a one-line addition, shown below.

## Build it with Claude

Ask Claude for a countdown that shows, after each turn, how long the prompt cache is expected to last. The one idea Claude must get right: the clock counts from the start of the last request, not from the end of the turn.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> In my Claude Code mod `my-pet`, show a prompt-cache countdown in the `AbovePrompt` band while Claude waits for me. In `turn.step`, for the main conversation only (`e.agentId === undefined`), record the time with `$.clock.now()` before the request and pass the stream through with `return yield* next(e)`. In `turn.complete`, for the main conversation, start a clock in an atom from that request time; clear it in `turn.start`. Last 60 minutes when `$.session.usage()` reports rate-limit windows and 5 minutes when it reports none, and let a `/pet cache <min>` command override it. Every few seconds with `$.clock.every`, recompute the whole minutes left, rounded up, and write the atom only when the number changed. Show "Cache: N min" and, at zero, "Cache cold: the next message is billed in full". Add a test with a mocked clock that a three-minute answer leaves two minutes of a five-minute cache.

### What to check in Claude's answer

1. The request time is recorded in `turn.step`, only for the main conversation (`e.agentId === undefined`), and the hook still passes the stream on with `return yield* next(e)`.
2. `turn.complete` starts the clock from that request time, and `turn.start` clears it, so there is no clock while Claude works.
3. The minutes left are rounded up, and the atom is written only when that number changes, not on every tick.
4. The cache lasts 60 minutes when the account has rate-limit windows and 5 when it has none, and a command can set it by hand.
5. A test with a mocked clock shows that a three-minute answer leaves two minutes of a five-minute cache.

If a check fails, tell Claude what you see: "after a long answer the clock shows the full 5 min", or "Claude's answers stopped appearing on screen".

### How the author asked for it

The original request for the cache clock was not recorded. It arrived on 2026-10-30, before the public task logs.

#### Recorded: the cache stays

The one recorded mention is in `odd/tasks/fleet-view.md` in narsil-pet, L2 (excerpt), when the author was removing sections of the band to make room for the list of conversations:

> "la del cache la mantenemos, la del dinero tambien podriamos eliminarla"

In English: we keep the cache one; the money one we could remove too. The spending count left; the cache clock stayed, and the agreed design in L4 put it in every conversation's row: "the list of conversations (state, title, context bar, cache clock)".

#### Reconstruction from the commit history

From `git log -- hooks/register.tsx hooks/words.ts`, the commits that touched the clock:

- `0993bd7` (2026-10-30) "feat: show a prompt-cache clock and offer next steps after a turn". The clock and the next steps arrive together, both started by the end of a turn.
- `0cfc369` (2026-10-31) "refactor: move Narsil's wording and labels out of the hooks module". The labels move to `hooks/words.ts`.
- `4f8abaa` (2026-11-01) "feat: send the state the band shows to a status topic for your own phone app". The cache travels to the phone.
- `49f0fd9` (2026-11-06) "feat: list every open conversation in the band". The clock moves into each row.
- `0072d87` (2026-11-07) "fix: make room for the cache in each band row".
- `c3e4464` (2026-11-09) "fix: count the prompt cache from the start of its last request". The correction above: before it, the clock started when the turn ended, and overstated what was left after a long answer.

## Reference code

This is one correct answer, written for this guide. Read it to understand how the pieces fit together and to compare it with what Claude wrote for you: Claude may choose other names or another order and still be right.

Written for this guide and checked against the 2.1.325 types (`turn.step`, `turn.start`, `turn.complete`, `$.clock.now`, `$.clock.every`, `$.session.usage`). It is adapted from `hooks/register.tsx` and `hooks/words.ts` in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). The `cache` atom is declared in `types/index.d.ts` as in the first guide, with the type `{ requestAt: number; minutes: number; left: number } | null`.

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const cache = atom({ plugin: 'my-pet', key: 'cache' } as const, null)
let lastRequestAt: number | null = null

const minutesLeft = (from: number, minutes: number, now: number) =>
  Math.max(0, Math.ceil((from + minutes * 60_000 - now) / 60_000))

async function cacheMinutes($: EngineInterface): Promise<number> {
  const usage = await $.session.usage().catch(() => undefined)
  return usage && usage.rateLimits.length > 0 ? 60 : 5
}

async function tick($: EngineInterface): Promise<void> {
  const c = await read($, cache)
  if (!c) return
  const left = minutesLeft(c.requestAt, c.minutes, await $.clock.now())
  if (left !== c.left) await update($, cache, (k) => (k ? { ...k, left } : k))
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    $.clock.every(5000, () => void tick($))
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined) lastRequestAt = await $.clock.now()
    return yield* next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) await update($, cache, () => null)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) return result
    const now = await $.clock.now()
    const requestAt = lastRequestAt ?? now
    const minutes = await cacheMinutes($)
    await update($, cache, () => ({
      requestAt,
      minutes,
      left: minutesLeft(requestAt, minutes, now),
    }))
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const c = await read($, cache)
    if (!c) return next(e)
    const { Text } = $.ui.resolve(e)
    const spent = 100 - (c.left / c.minutes) * 100
    const color = spent >= 85 ? '#F0435A' : spent >= 60 ? '#F5B400' : '#22B573'
    return c.left > 0 ? (
      <Text color={color}>{`🧊 Cache: ${c.left} min`}</Text>
    ) : (
      <Text color={color}>🧊 Cache cold: the next message is billed in full</Text>
    )
  })
}
```

This version asks `$.session.usage()` at the end of each turn. Narsil reads the same figures from its `usage` atom instead, kept current by `session.measure` (previous guide), which spares the call.

## Common mistakes and how to test it

- **Counting from the end of the turn.** The cache's life starts with the request. After a long answer, a clock started at the end shows minutes that are already gone (`c3e4464`).
- **Letting subagents move the clock.** A subagent's requests raise `turn.step` too, with `e.agentId` set, and they have their own cache. Narsil records only the main conversation's.
- **A clock while Claude works.** Every new request writes the cache again, so a countdown during a turn means nothing. Clear it in `turn.start`.
- **Redrawing every tick.** Recompute often, write only when the minute changes.
- **Treating 60 and 5 as facts.** They are the mod's assumption about how Claude Code and the API configure the cache. Give the person a way to override them.
- **Swallowing the stream in `turn.step`.** The hook is a generator: forward every chunk (`return yield* next(e)` or a `for await` that yields each one), or the answer stops reaching the screen.

To test, `claude plugin test .` runs `tests/narsil.test.tsx` with a mocked clock. "after a turn the band counts down the prompt cache, and says when it has gone cold" checks "🧊 Caché: 5 min" off a plan, then "🧊 Caché: 2 min", then "🧊 Caché fría" in the band while the hub receives the full sentence, and that a new turn removes the clock. "the cache counts from the start of the last request, not from the end of the turn" checks "🧊 Caché: 2 min" after a three-minute answer and the exact `cacheEndsAt` sent to the hub. "a request of a subagent does not move the cache clock of the conversation" and "on a plan the cache lasts an hour, and /narsil cache sets it by hand" cover the rest.

## Going further

- `stepsCommand` in `hooks/register.tsx` handles `/narsil cache`, `/narsil cache auto` and `/narsil cache <min>`, and also accepts `caché` with its accent.
- `offerSteps` uses the same end-of-turn moment, `at`, to offer next steps 15 minutes after a turn (`STEPS_AFTER_MS`).
- `shownState` sends `cache`, `cacheEndsAt` and `cacheMinutes` to the hub for the floating window, the other conversations and the phone.
- `cacheColor` in `hooks/words.ts` is ready for a colored clock, using the same `levelColor` thresholds as the usage bars in `hooks/usage.ts`.
