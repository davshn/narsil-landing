---
title: Experience and growth
description: 'How Narsil earns experience from finished turns, passing tests and finished subagents, levels up, grows through five stages and celebrates, with XP kept across sessions.'
route: pet
order: 13
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/xp.ts
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: hooks/sprite.ts
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: hooks/phone.ts
  - repo: pet
    path: types/index.d.ts
  - repo: pet
    path: odd/tasks/animated-poses.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## What it does

Narsil grows with the work she watches. Each finished turn, each test run that passes and each subagent that finishes well gives her experience points (XP). With enough XP she reaches a new level, and at some levels she grows into a new stage of her life: from a hatchling to a grown sea serpent.

From your side, three things show it:

- **A level label** next to her name, in the band and in the floating window: "⭐ Nivel 3 · 120/300 XP" ("Level 3, 120 of the 300 XP this level needs").
- **A celebration** when she levels up: a golden glow, rings, stars and a "NIVEL 3" banner over her picture, and the band's comment says "¡He subido al nivel 3! ⭐" ("I reached level 3!"). A new stage is celebrated differently: a flash, light rays, a "¡ETAPA 2!" banner, and "¡He crecido!" ("I have grown!").
- **Her look.** Each of the five stages has its own drawings, and she moves differently: the hatchling bounces light and quick, the grown serpent moves slow and heavy.

`/narsil nivel` tells you where she stands, the stage, and how she earns XP.

The XP is one number for the whole machine. It survives closing Claude Code, and every open conversation adds to the same total. It is a small reward loop with no effect on Claude's work: it only changes what Narsil looks like.

## How it works inside

### The rules: `hooks/xp.ts`

All the arithmetic lives in `hooks/xp.ts`, as pure functions over plain numbers. The file says so in its first comment: "the hooks module owns the store and the events". That split makes the rules easy to test without an engine.

The gains are one table, `XP_GAIN`:

| Reason  | XP  | When                                     |
| ------- | --- | ---------------------------------------- |
| `turn`  | 10  | a turn of the main conversation answers  |
| `tests` | 5   | a test command runs without error        |
| `agent` | 3   | a subagent's own turn ends with `answer` |

Levels grow linearly harder. `levelOf` starts at level 1 and subtracts `level * 100` while it can: level 1 needs 100 XP to reach level 2, level 2 needs 200 more, level 3 needs 300 more, and so on. It returns the level, the XP gathered into this level (`into`) and the XP this level needs (`needed`), which is exactly what the label prints.

The stages are a second table, `STAGE_FROM = [1, 5, 10, 20, 35]`: the first level of each stage. `stageOf(level)` counts how many of those the level has reached. So:

| Stage         | Levels   | Total XP to get there |
| ------------- | -------- | --------------------- |
| 1 (hatchling) | 1 to 4   | 0                     |
| 2             | 5 to 9   | 1,000                 |
| 3             | 10 to 19 | 4,500                 |
| 4             | 20 to 34 | 19,000                |
| 5             | 35 on    | 59,500                |

The totals follow from the rule: reaching level L takes 100 × (1 + 2 + … + (L − 1)) XP. At 10 XP a turn, the hatchling becomes stage 2 after about a hundred finished turns, and stage 5 is a long way off. The README states the same rules in Spanish.

`xpOf` reads a stored value "from any version, or none": anything that is not a positive finite number counts as 0, and a fraction is floored. A broken or missing store therefore starts Narsil over instead of breaking the band.

### Where the XP comes from

`gainXp($, reason)` in `hooks/register.tsx` is called from four places, under three events:

- **`turn.complete`**, main conversation, when the turn ends with `answer`. Two branches call it: the normal finish ("He terminado") and a finish that asks a question in the desktop app's next-step box. A turn that ends while background work still runs does not earn XP yet: the turn that wakes the session when that work reports is the one that finishes, and earns it. A turn you stop (`aborted`) or that fails earns nothing.
- **`tool.call`**, when the command matches `TEST_COMMAND` (in `hooks/words.ts`: `npm test`, `pnpm test`, `vitest`, `pytest`, `cargo test`, `claude plugin test` and others) and the result has no `isError`. This check does not look at `e.agentId`, so a subagent's passing tests count too.
- **`endAgent`**, called from `turn.complete` when `e.agentId` is set and the subagent's reason is `answer`.

The test `passing tests and finished subagents earn experience; failures and stopped turns do not` in `tests/narsil.test.tsx` pins all of this.

### Why it lives in `$.store`, and why it is read again

Narsil keeps two copies of the XP:

- **`$.store`**, under the key `xp`. The types describe the store as "This plugin's own key-value store, kept between sessions and hot reloads", a JSON file of the plugin's own under the Claude Code configuration directory. That is what makes the XP outlive a session.
- **The `xp` atom** (`$.state`), which the band and the floating window read while they draw, so a change redraws them.

At `session.start`, Narsil copies the stored value into the atom. Then each gain does this:

```tsx
const before = xpOf(await $.store.get(XP_KEY).catch(() => read($, xp)))
const after = before + XP_GAIN[reason]
await $.store.set(XP_KEY, after).catch(() => undefined)
await update($, xp, () => after)
```

The comment above it gives the reason for reading the store first instead of trusting the atom: "another open conversation may have added to it since". The store is shared by every conversation of the plugin, while each conversation has its own atom. Adding to the atom would overwrite the gains another window made since this one started. The test `another conversation’s experience is added to, never overwritten` sets the store to 50 behind the conversation's back and expects 60 after a turn.

Reading again shrinks the window for lost gains; it is not a lock. Two conversations that gain XP in the same instant can still both read the same `before`.

If the store fails, the gain still reaches the atom (`.catch(() => read($, xp))` and `.catch(() => undefined)`), so the band keeps counting for this session.

### Celebrations: the `milestone` atom

When `after` crosses a level, `gainXp` compares the stages before and after and writes the `milestone` atom: `{ kind: 'level' | 'grew', level, stage, at }`. Its type, `(Milestone & { at: number }) | null`, is declared in `types/index.d.ts`. It also:

- writes a log line with `$.ui.log`: "🌊 Narsil ha crecido: nivel 5, etapa 2 de 5." or "⭐ Narsil ha subido al nivel 3.";
- replaces her comment in the band through `setMood`, keeping her current mood and detail.

The drawing reads the milestone. `sprite(mood, stage, milestone)` in `hooks/sprite.ts` adds:

- for a level, `behind` draws a golden radial glow, and `celebration` draws two expanding rings, seven stars and a `NIVEL <n>` banner;
- for a stage, a white flash, five sparks, twelve light rays and a `¡ETAPA <n>!` banner, with the picture wrapped in an `evolve` animation that scales her from half size to her new self.

While a milestone shows, the small state badge near her head is left out, so the two do not fight for the same space.

The heartbeat (`beat`, every 2 seconds) clears the milestone once `MILESTONE_MS` has passed: 6 seconds for a level, 9 for a stage. A timer per celebration would have been simpler to write, but the heartbeat already exists, and a `$.clock` timer is lost on a reload of the mod.

In the band, the celebration is drawn only when the conversation Narsil shows is this one (`isOwnTop`): when another conversation is more important, the picture belongs to it.

### What the stage changes

`stageOf(levelOf(xp).level)` is computed wherever a picture is made:

- **The art.** `art` in `hooks/sprite.ts` picks the pose drawn for that stage and theme, falling back to the base pose of the stage, and then to an earlier stage, when one is missing. The animated loops of every stage come from the task recorded in `odd/tasks/animated-poses.md`; the second guide of this path covers the drawing.
- **The motion.** `STAGE_MOTION` scales how far and how fast she moves: amplitude 1.15 and tempo 0.9 for the hatchling down to 0.6 and 1.4 for stage 5.
- **Everything outside the band.** The tip window receives `NARSIL_STAGE`; phone alerts use `phoneIcon(kind, stage)`, a PNG of her at that stage from the repository; the `-estado` topic sends the `xp` label and the `art` URL (guide 15).

## How it was asked of the AI

The original request for experience and levels was not recorded. The project's public task logs start later.

One later request touches the stages: in `odd/tasks/animated-poses.md`, L4 (2026-11-15), after the first animated loop, the author answered:

> "si me agrada, vamos a cambiar todos"

In English: I like it, let's change them all. The task log turns it into S6: every pose "at every stage 1-5, light and dark: 60 loops".

### Reconstruction from the commit history

From `git log -- hooks/xp.ts` and the related commits:

- `8913cdd` (2026-10-30) "feat: let Narsil earn experience and levels kept across sessions". XP, levels and the store arrive together.
- `9bfa039` (2026-10-30) "feat: let Narsil grow through five stages as she levels up". The same day, the stages.
- `7a964d1` (2026-10-30) "feat: draw Narsil as a hatchling at stage 1 and split the art per stage", followed on 2026-10-31 by one commit per stage and theme (`6b96e08`, `e029cf0`, `ff02847`, `6a1ceb3`, `4055242`, `b7361a0`, `5ef599a`, `eed13b0`).
- `2cf7133` (2026-10-31) "feat: celebrate a new level and a new stage with their own animations". The `milestone` atom and the two celebrations.
- `fcd68c7` (2026-10-31) "feat: move Narsil by her stage, with a shadow, splashes, a softer tremble and cheap glows". `STAGE_MOTION`.
- From 2026-11-15 to 2026-11-16, the animated loops of every stage (`2f08c55` to `673fc9f`), the task quoted above.

The order is telling: the numbers first, then the stages that make the numbers visible, then a picture per stage, then celebrations, then motion. Each step makes the reward easier to notice.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> In my Claude Code mod `my-pet`, give the pet experience. Put the rules in a pure module `hooks/xp.ts`: 10 XP per finished main-conversation turn (`turn.complete` with `reason === 'answer'` and no `agentId`), 5 when a test command (`npm test`, `pnpm test`, `vitest`, `pytest`) returns without `isError` in `tool.call`, 3 when a subagent's `turn.complete` ends with `answer`. Level 1 needs 100 XP, each next level 100 more than the last; stages start at levels 1, 5, 10, 20 and 35. Keep the total in `$.store` under `xp` so it survives sessions, and before each gain read the store again, since other conversations add to it. Mirror it in an atom for drawing. On a new level write a `milestone` atom with the time, show "Level N" in the `AbovePrompt` band for 6 seconds (9 for a new stage) and log it with `$.ui.log`. Test with `claude-code/testing`: a turn at 95 XP shows level 2, and a store changed behind the conversation's back is added to, not overwritten.

## The minimal code

Written for this guide and checked against the 2.1.325 types (`$.store.get`, `$.store.set`, `$.clock.now`, `$.ui.log`, `session.start`, `tool.call`, `turn.complete`, `ui.render`). It is adapted from `hooks/xp.ts` and `hooks/register.tsx` in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). The atoms are declared in `types/index.d.ts` as in the first guide: `xp: number` and `milestone: { kind: 'level' | 'grew'; level: number; at: number } | null`.

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const GAIN = { turn: 10, tests: 5, agent: 3 } as const
const STAGE_FROM = [1, 5, 10, 20, 35]
const SHOWN_MS = { level: 6000, grew: 9000 } as const
const TESTS = /\b(?:(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?test|vitest|jest|pytest)\b/

const xp = atom({ plugin: 'my-pet', key: 'xp' } as const, 0)
const milestone = atom({ plugin: 'my-pet', key: 'milestone' } as const, null)

function levelOf(total: number) {
  let level = 1
  let left = Math.max(0, Math.floor(total))
  while (left >= level * 100) {
    left -= level * 100
    level += 1
  }
  return { level, into: left, needed: level * 100 }
}
const stageOf = (level: number) => STAGE_FROM.filter((from) => level >= from).length || 1
const xpOf = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0

async function gain($: EngineInterface, reason: keyof typeof GAIN): Promise<void> {
  // Read the store again: another conversation may have added to it.
  const before = xpOf(await $.store.get('xp').catch(() => read($, xp)))
  const after = before + GAIN[reason]
  await $.store.set('xp', after).catch(() => undefined)
  await update($, xp, () => after)
  const was = levelOf(before).level
  const level = levelOf(after).level
  if (level === was) return
  const kind = stageOf(level) > stageOf(was) ? ('grew' as const) : ('level' as const)
  const at = await $.clock.now()
  await update($, milestone, () => ({ kind, level, at }))
  $.ui.log(kind === 'grew' ? `My pet has grown: level ${level}` : `My pet reached level ${level}`)
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    const stored = xpOf(await $.store.get('xp').catch(() => 0))
    await update($, xp, () => stored)
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const command = (e as { command?: unknown }).command
    const result = await next(e)
    if (typeof command === 'string' && TESTS.test(command) && !result.isError)
      await gain($, 'tests')
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.reason === 'answer') await gain($, e.agentId === undefined ? 'turn' : 'agent')
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { level, into, needed } = levelOf(await read($, xp))
    const shown = await read($, milestone)
    const isFresh = shown !== null && (await $.clock.now()) - shown.at < SHOWN_MS[shown.kind]
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="row" gap={1} minWidth={0}>
        <Text dimColor>{`⭐ Level ${level} · ${into}/${needed} XP · stage ${stageOf(level)}`}</Text>
        {isFresh ? (
          <Text bold color="#F5B400">
            {shown.kind === 'grew' ? 'I have grown!' : 'Level up!'}
          </Text>
        ) : null}
      </Box>
    )
  })
}
```

Two simplifications against Narsil. The band checks the milestone's age when it draws, so the celebration leaves at the next redraw after its time; Narsil clears the atom on its heartbeat, which redraws on time. And this version counts every subagent turn that answers, while Narsil counts a subagent only once, through its own record of running subagents.

## Common mistakes and how to test it

- **Keeping XP only in an atom.** `$.state` survives a reload of the mod, not a new session. Anything meant to last goes in `$.store`.
- **Writing the atom's value back to the store.** With two conversations open, each atom lags behind the other's gains. Read the store, add, write.
- **Trusting a stored value.** A store edited by hand, or written by an older version, can hold anything. Validate it (`xpOf`) and fall back to zero.
- **Rewarding failure.** Award the turn only on `answer`, and the tests only without `isError`; an aborted turn earns nothing.
- **Celebrating forever.** A milestone needs an end time and something that redraws when it passes.
- **Levels that never come.** Check your curve with numbers before shipping it. With Narsil's, stage 5 needs 59,500 XP, which is several thousand turns.

To test, the tests in `tests/narsil.test.tsx` start the mod with a store set in advance and read it back. Worth reading: "Narsil keeps her experience across sessions, and celebrates a new level" (95 XP plus a turn shows "⭐ Nivel 2 · 5/200 XP" and "¡He subido al nivel 2! ⭐"), "Narsil grows at levels 5, 10, 20 and 35, and says so", "a new level plays its own celebration for a while, in the band and the window" and "levels need 100, 200, 300 XP more each, and odd stored values count as none". "the celebrations stay within the Svg size limit at every stage" guards something easy to forget: a celebration adds to a picture that already has its size limit.

## Going further

- `xpLabel` in `hooks/xp.ts` is the one place the label is written, so the band, the floating window and the phone's state say the same thing.
- `banner`, `behind` and `celebration` in `hooks/sprite.ts` draw the celebrations as SVG over the picture.
- `artUrl` in `hooks/phone.ts` builds the address of her picture at each stage for the phone, as the repository publishes it under `assets/`.
- The next guide, quiet mode, shows how Narsil keeps quiet without losing what matters; a celebration is one of the things that still shows, since it is only drawn.
