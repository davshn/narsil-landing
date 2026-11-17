---
title: Quiet mode
description: 'How /narsil discreto silences Narsil without losing the alerts that matter: what stops, what still gets through, and why the line is drawn at "she needs you".'
route: pet
order: 14
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: types/index.d.ts
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## What it does

Narsil talks a lot by design: she speaks when work starts and ends, alerts when a turn finishes, gives tips, proposes next steps and sums up the session. On a day of meetings, or simply in a shared office, that is too much.

`/narsil discreto` ("discreet") turns all of that down at once. She stops speaking, stops alerting when a turn ends, and stops offering tips and next steps on her own. She still alerts you, without a voice, when she needs you or something failed, and the band still shows what she is doing. `/narsil normal` brings everything back as it was.

Narsil has three ways to step back, and it helps to tell them apart:

| Command            | What it changes                                                          |
| ------------------ | ------------------------------------------------------------------------ |
| `/narsil silencio` | Only the voice. Every alert, tip and step still comes, in writing.       |
| `/narsil ocultar`  | Only the band. Voice and alerts keep going.                              |
| `/narsil discreto` | Voice off, end-of-turn alerts off, automatic extras off; the rest stays. |

Each has its opposite: `voz`, `mostrar` and `normal`. They are independent switches, so `/narsil normal` turns the quiet mode off without turning a muted voice back on.

## How it works inside

### One preference: `isQuiet`

Quiet mode is a single boolean, `isQuiet`, in the `prefs` atom of `hooks/register.tsx` (its type, `Prefs`, is in `types/index.d.ts`). The `/narsil` command handler writes it through a small table:

```tsx
const change: Record<string, Partial<Prefs>> = {
  ocultar: { isHidden: true },
  mostrar: { isHidden: false },
  silencio: { isMuted: true },
  voz: { isMuted: false },
  discreto: { isQuiet: true },
  normal: { isQuiet: false },
}
```

The patch is merged into the atom and the whole `prefs` object is saved with `$.store.set('prefs', …)`, so the mode lasts across sessions until you change it. At `session.start`, the stored preferences are merged over the defaults, which also covers older stored values that do not have the field yet.

There is no "quiet" code path of its own. Instead, every place that makes noise reads `isQuiet` and decides for itself. That keeps the rule next to the thing it governs, and it means a new kind of noise has to opt in to quiet mode explicitly.

### The line it draws: "needs you" gets through

Every alert goes through `announce` (guide 6 covers it in full). Its first lines are where quiet mode lives:

```tsx
const { isMuted, isFloating, isQuiet } = await read($, prefs)
// Quiet: no voice, and only what needs you (a question, an error) is told.
if (isQuiet && kind === 'done' && !force) return
const spoken = isMuted || isQuiet ? Promise.resolve() : speak($, voice)
```

An alert has one of three kinds: `done`, `question` or `error`. In quiet mode:

- a `done` alert returns before anything happens: no floating window, no system notification, no phone, no voice;
- a `question` or an `error` goes on as usual to the floating window (or a system notification when the window is off) and to the phone, only without the voice.

The reason for this line is in the comment and in the README: what stops is what you can safely miss. A finished turn will still be finished when you look. A question or a permission blocks the work until you answer, and an error means the work stopped. Silencing those would turn a quiet mode into a broken one.

The `force` flag lets two callers through anyway. `/narsil prueba`, the test alert, is forced, so you can check your alerts even in quiet mode. The five-minute reminder for a permission or question left waiting is forced too, though as a `question` it would get through regardless.

### What each kind of alert does in quiet mode

Walking through the callers of `announce`:

| Moment                                  | Kind       | Quiet mode               |
| --------------------------------------- | ---------- | ------------------------ |
| A turn finishes ("He terminado")        | `done`     | stopped                  |
| A background subagent finishes well     | `done`     | stopped                  |
| A background subagent stops or fails    | `error`    | shown, no voice          |
| A turn fails ("Me he detenido")         | `error`    | shown, no voice          |
| A question, a plan or a permission      | `question` | shown, no voice          |
| A turn ends asking in the next-step box | `question` | shown, no voice          |
| Still waiting after 5 minutes           | `question` | shown, no voice          |
| `/narsil prueba`                        | `done`     | shown (forced), no voice |

### The other noises

Outside `announce`, four more places read `isQuiet`:

- **The voice at the start of work.** In `turn.start`, a prompt you typed makes her say a start phrase, unless `isMuted` or `isQuiet`.
- **Automatic tips.** `mayTip` returns false when `isQuiet`, before counting anything. A tip you ask for with `/narsil consejo` is not automatic and still answers.
- **Next steps.** `offerSteps` returns at once when `isQuiet`.
- **The idle session summary.** `tickWatch` shows the summary after 30 quiet minutes only when `isQuiet` is false. `/narsil resumen` still answers.

### What quiet mode does not touch

Reading the code also tells you what stays, and it is worth knowing:

- **The band and the floating window's content.** States, headlines, comments, the conversation list, the cache clock and a level-up celebration are drawn as before. Quiet mode is about interruptions, not information.
- **The `/compact` suggestion** of guide 7. It is checked against `isAdviceOn`, not `isQuiet`, so it can still appear in quiet mode. `/narsil consejos off` stops it.
- **The warning about dangerous commands** of guide 9: it is a comment in the band and a log line, not an alert.
- **The silent state sent to the phone's `-estado` topic** (guide 15). It never makes a notification, and, while phone alerts are on and you write from away, it goes after every turn whatever the mode.

When the mode is on, the bare `/narsil` command adds a line to its report: "Modo discreto activado: sin voz, sin avisos de fin de turno ni consejos o pasos automáticos." ("Quiet mode on: no voice, no end-of-turn alerts, no automatic tips or steps.")

## How it was asked of the AI

The original request for quiet mode was not recorded. The project's public task logs do not cover it.

### Reconstruction from the commit history

From `git log -S isQuiet -- hooks/register.tsx` in narsil-pet:

- `17ffb30` (2026-10-31) "feat: add a quiet mode that only speaks up when Narsil needs you". One commit adds the whole mode: the `isQuiet` field, the early return in `announce`, the checks in the tips, the next steps and the idle summary, the `discreto` and `normal` words, the line in the bare command's report, a README section and a test. Its subject is the design in one sentence.
- `665bd4e` (2026-11-06) "feat: speak when work starts and vary every spoken phrase". The start-of-work voice is new here, and it reads `isQuiet` from the first day. This is the pattern in action: a new noise opts in to quiet mode when it is added.

The mode arrived late in the first week, after the voice, the alerts, the tips and the next steps already existed. That order fits a common path: a mod gains features one at a time, and only once they pile up does it need a single switch to turn them down.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> My Claude Code mod `my-pet` speaks, alerts at the end of each turn and shows tips. Add a quiet mode: `/my-pet quiet` and `/my-pet normal` set a boolean `isQuiet` in the preferences, saved with `$.store.set` and loaded at `session.start`. In the function that sends every alert, which takes a kind (`done`, `question`, `error`), return early for `done` when quiet unless the alert is a forced test, and never speak when quiet; questions and errors still show. Also skip the automatic tips when quiet, but keep tips the person asks for. Leave the band as it is. Add tests with `claude-code/testing`: in quiet mode a finished turn makes no notification and no voice, and an `AskUserQuestion` call still notifies.

## The minimal code

Written for this guide and checked against the 2.1.325 types (`$.store.get`, `$.store.set`, `$.command.register`, `command.run`, `$.ui.notify`, `session.start`, `turn.complete`, `tool.call`). It is adapted from `hooks/register.tsx` in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). The `prefs` atom is declared in `types/index.d.ts` as `{ isQuiet: boolean }`. The empty `speak` function is where your own voice goes, such as the one in guide 6.

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

type Kind = 'done' | 'question' | 'error'
const prefs = atom({ plugin: 'my-pet', key: 'prefs' } as const, { isQuiet: false })

async function speak($: EngineInterface, text: string): Promise<void> {
  // your own voice goes here (guide 6)
}

async function announce(
  $: EngineInterface,
  kind: Kind,
  title: string,
  text: string,
  force = false,
) {
  const { isQuiet } = await read($, prefs)
  // What you can safely miss stays quiet; what blocks the work never does.
  if (isQuiet && kind === 'done' && !force) return
  const spoken = isQuiet ? Promise.resolve() : speak($, text)
  try {
    await $.ui.notify(text, { title })
  } catch {
    // no notification channel on this surface
  }
  await spoken
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'my-pet', description: 'My pet: quiet | normal | test' })
    const saved = await $.store.get('prefs').catch(() => undefined)
    if (saved && typeof saved === 'object') await update($, prefs, (p) => ({ ...p, ...saved }))
    return next(e)
  })

  on('command.run', { command: 'my-pet' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'test') {
      await announce($, 'done', 'Test', 'This is how I will tell you.', true)
      return { text: 'My pet: test alert sent.' }
    }
    if (arg !== 'quiet' && arg !== 'normal') return { text: 'Usage: /my-pet quiet | normal | test' }
    const saved = await update($, prefs, (p) => ({ ...p, isQuiet: arg === 'quiet' }))
    await $.store.set('prefs', saved).catch(() => undefined)
    return {
      text: saved.isQuiet
        ? 'My pet: quiet. I only tell you when I need you.'
        : 'My pet: back to normal.',
    }
  })

  on('tool.call', async ($, e, next) => {
    if (e.agentId === undefined && e.tool === 'AskUserQuestion')
      await announce($, 'question', 'I need you', 'I have a question for you.')
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) return result
    if (e.reason === 'answer') await announce($, 'done', 'Done', 'I have finished.')
    else if (e.reason !== 'aborted')
      await announce($, 'error', 'I stopped', 'The turn ended with an error.')
    return result
  })
}
```

`update` returns the new value, so the command saves exactly what it wrote. The `try` around `$.ui.notify` follows a comment in Narsil's `notify`: where the host has no notify at all, "the call throws before it returns a promise", so a `.catch` would not catch it.

## Common mistakes and how to test it

- **Silencing everything.** A quiet mode that also stops questions and errors leaves Claude waiting on a permission nobody sees. Decide per kind of alert, by whether missing it blocks the work.
- **One flag in one place.** If only the alert function reads the flag, every noise added later ignores it. Narsil reads `isQuiet` in each place that makes noise, and adds the check when it adds the noise.
- **Letting quiet mode stop the test.** Without `force`, `/narsil prueba` would do nothing in quiet mode, and the person would think alerts are broken.
- **Coupling switches.** `normal` should undo `discreto` only. If it also unmuted the voice, a person who muted Narsil first would hear her again.
- **Forgetting to persist.** A preference kept only in an atom is gone with the next session.

To test, `tests/narsil.test.tsx` has two tests for it. "/narsil discreto keeps her quiet, and /narsil normal brings everything back" runs on a simulated macOS without the floating window, records the scripts started for the voice and the notifications, finishes a turn and lets eleven minutes pass: nothing is spoken, no notification starts, no model is asked; then an `AskUserQuestion` call makes exactly one notification titled "Narsil · Te necesito". "in quiet mode the phone gets only what needs you" checks the same rule on the phone: after a finished turn and a question, only the question is posted.

## Going further

- `announce` in `hooks/register.tsx` is the one function to read for where each alert goes; the voice-and-alerts guide walks through it.
- The bare `/narsil` command prints every preference at once, including this one. The last guide of the path, on commands, shows how it is built.
- The next guide sends the same alerts to your phone and watch, under the same quiet rule.
