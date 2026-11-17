---
title: Permissions that wait
description: 'How Narsil insists once when a permission, a question or a plan has waited five minutes for you, and why it checks on a heartbeat instead of setting a timer.'
route: pet
order: 10
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: hooks/watch.ts
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: overlay/server.cjs
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## What it does

Claude often stops in the middle of a turn to ask you something: permission to run a tool, a question, or a plan to approve. Narsil tells you at that moment, as the earlier guides show (the "TE NECESITA" state, the voice, the floating window).

But that first alert is easy to miss. You were in another window, or you saw it and meant to come back. Five minutes later, if the same thing is still waiting, Narsil insists once:

```text
Sigo esperándote
Sigo esperándote desde hace 5 min: pido permiso para usar Bash.
```

"I am still waiting for you, for 5 minutes now: I am asking permission to use Bash." The second half names what waits, so a question reads "tengo una pregunta para ti" ("I have a question for you") and a plan "tengo un plan para que lo apruebes" ("I have a plan for you to approve").

The insistence goes out as a question alert: in the floating window, aloud with one of the `stillWaiting` phrases ("Sigo aquí, esperándote.", "I am still here, waiting for you"), and to the phone under the rules of the voice and alerts guide. The README adds the detail that sets it apart from the first alert: it shows "aunque estés mirando Claude", even while you are looking at Claude.

It happens once per wait. If you still do not answer, Narsil does not keep insisting.

## How it works inside

### A wait is one module variable

What waits is held in one variable in `hooks/register.tsx`:

```tsx
let waiting: { since: number; what: string; isNudged: boolean } | null = null
```

`startWaiting($, what)` fills it with the current time from `$.clock.now()`; `stopWaiting()` sets it back to `null`. A module variable is enough: the wait belongs to this conversation, and nobody else reads it.

### What starts a wait

Three places call `startWaiting`, the same three that raise the first alert:

- **`classic.PermissionRequest`**, a permission dialog. The first guide explains why Narsil listens here and not to `tool.check`: the engine raises it only when it is about to show you the dialog. The hook still skips it when a settings hook already answered (`result.decision` is set) or the mode is `bypassPermissions`.
- **`tool.call` for `AskUserQuestion` or `ExitPlanMode`**, a question or a plan. Here the wait is wrapped around the call itself: `startWaiting` before `next(e)`, and `stopWaiting()` in a `finally`, so it ends when the tool returns however it returns.
- **`turn.complete` with a question in the desktop app's next-step box**, a turn that ended by asking you something.

### What ends it

No timer is set, so there is nothing to cancel. A wait ends when `waiting` goes back to `null`, and every sign that you answered does that:

- `classic.PostToolUse` and `classic.PostToolUseFailure`: the tool ran, so you allowed it.
- `classic.PermissionDenied`: you said no. The comment over these three hooks: "A permission answered, either way: nothing waits any more."
- Any other `tool.call`: another step started, so whatever waited was answered.
- `turn.start` and `turn.complete`: a new turn, or the end of this one.

### No timer: the heartbeat checks

Narsil already has a heartbeat: `$.clock.every(2000, ...)` started in `session.start`, which also counts the cache down (guide 8). On every beat, `tickWatch` asks one question:

```tsx
if (waiting && !waiting.isNudged && now - waiting.since >= NUDGE_AFTER_MS) {
  waiting.isNudged = true
  const text = nudgeText(waiting.what, now - waiting.since)
  void announce($, 'question', 'Sigo esperándote', text, say('stillWaiting'), true).catch(
    () => undefined,
  )
}
```

The 2.1.325 types offer a one-shot timer, `$.clock.after`, and a version could start one in each `startWaiting` and cancel it in each `stopWaiting`. Narsil does not, and its code says why in another place: a comment in `turn.complete` notes that a reload of the mod, which follows any turn that edited it, cancels `$.clock` timers. With the heartbeat, the check is a comparison of two numbers, and none of the places that end a wait has to remember a timer.

The heartbeat does not make the wait survive a reload either: `waiting` is a module variable and starts empty again. The difference is in how it fails. A lost wait means one missed reminder, never a reminder for something you already answered.

### Why once, and why five minutes

`isNudged` makes it once. A reminder every five minutes would turn Narsil into the kind of alarm people switch off, and the first alert plus one reminder already covers the usual case of a missed notification.

Five minutes is `NUDGE_AFTER_MS` in `hooks/watch.ts`. It was two minutes at first; the commit that raised it, `2bcc97c`, is titled "calm loop, steps and permission alerts". The same commit moved the next steps from 3 to 15 minutes: the author was spacing out everything Narsil says unasked.

`nudgeText` builds the sentence; `took` from `hooks/agents.ts` writes the time ("5 min").

### Why it shows even while you look

The last argument to `announce`, `true`, is `force`. The floating window of guide 5 normally appears only when Claude is not in front. A forced event is shown anyway: `overlay/server.cjs` shows the event when Claude is not in the foreground or the event is forced, and a forced event also reopens a window you closed less than a minute ago.

Neither the code nor the README says why; this guide's reading is that if five minutes have passed and the thing still waits, the first alert did not work, and the fact that Claude is in front does not mean you saw it.

`announce` keeps the person's own choices: muted or quiet means no voice, and the floating window turned off means a system notification instead. Quiet mode (`/narsil discreto`) silences only the end-of-turn announcements, so a reminder that something needs you still arrives, without the voice.

## How it was asked of the AI

The original request for the reminder was not recorded. It arrived on 2026-10-30, before the public task logs.

### Recorded: the loop alert that left

The reminder was born in the same commit as a loop alert, which warned when Claude kept failing or editing the same files. The author's first request in `odd/tasks/fleet-view.md` in narsil-pet, L1 (2026-11-06, excerpt), removed that one:

> "(eliminariamos la alerta de bucle, no la he sentido tan util)"

In English: we would remove the loop alert, I have not found it that useful. The task log turns it into S9, "Loop alert removed", and commit `21e7288` drops it. The reminder for a waiting permission stayed.

### Reconstruction from the commit history

From `git log -- hooks/register.tsx hooks/watch.ts`:

- `2027f06` (2026-10-30) "fix(alerts): only alert when a permission dialog needs your answer". The move to `classic.PermissionRequest`, which also decides what starts a wait.
- `f7a494e` (2026-10-30) "feat: warn about loops, insist on waiting permissions and sum the session up". The reminder, with a wait of two minutes.
- `2532e7c` (2026-11-02) "feat: alert as a question when a turn ends asking in the desktop app's next-step box". That question is a wait too today.
- `2bcc97c` (2026-11-05) "feat: open the context breakdown from the usage bars and calm loop, steps and permission alerts". Its message: "a waiting permission is insisted on after 5 minutes".
- `21e7288` (2026-11-06) "refactor: drop the loop alert, the spending count and the open-conversations line".

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> In my Claude Code mod `my-pet`, remind me once when a permission waits too long. Keep a module variable `waiting` with `since`, `what` and `isNudged`. Start it in `classic.PermissionRequest` after `next(e)`, unless `result.decision` is set or `e.permission_mode` is `bypassPermissions`. Clear it in `classic.PostToolUse`, `classic.PostToolUseFailure`, `classic.PermissionDenied`, any other `tool.call`, `turn.start` and `turn.complete`. Do not use `$.clock.after`: in `session.start`, start one `$.clock.every(2000, ...)` heartbeat that, when five minutes have passed and `isNudged` is false, sets it and sends one notification with `$.ui.notify`. Add a test with a mocked clock: nothing at 4 minutes 50 seconds, exactly one reminder after 15 minutes, and none when the permission was answered after one minute.

## The minimal code

Written for this guide and checked against the 2.1.325 types (`classic.PermissionRequest` and its `decision`, `classic.PostToolUse`, `classic.PostToolUseFailure`, `classic.PermissionDenied`, `$.clock.every`, `$.clock.now`, `$.ui.notify`). It is adapted from `hooks/register.tsx` and `hooks/watch.ts` in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later).

```tsx
import type { EngineInterface, Register } from 'claude-code'

const NUDGE_AFTER_MS = 5 * 60_000
let waiting: { since: number; what: string; isNudged: boolean } | null = null

async function startWaiting($: EngineInterface, what: string): Promise<void> {
  waiting = { since: await $.clock.now(), what, isNudged: false }
}

function stopWaiting(): void {
  waiting = null
}

async function beat($: EngineInterface): Promise<void> {
  if (!waiting || waiting.isNudged) return
  const waited = (await $.clock.now()) - waiting.since
  if (waited < NUDGE_AFTER_MS) return
  waiting.isNudged = true
  const minutes = Math.round(waited / 60_000)
  void $.ui
    .notify(`Still waiting for you after ${minutes} min: ${waiting.what}`, { title: 'my-pet' })
    .catch(() => undefined)
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    $.clock.every(2000, () => void beat($))
    return next(e)
  })

  on('classic.PermissionRequest', async ($, e, next) => {
    const result = await next(e)
    const isDecided = result.decision !== undefined || e.permission_mode === 'bypassPermissions'
    if (!isDecided) await startWaiting($, `permission to use ${e.tool_name}.`)
    return result
  })

  // Answered, either way: nothing waits any more.
  on('classic.PostToolUse', async ($, e, next) => {
    stopWaiting()
    return next(e)
  })
  on('classic.PostToolUseFailure', async ($, e, next) => {
    stopWaiting()
    return next(e)
  })
  on('classic.PermissionDenied', async ($, e, next) => {
    stopWaiting()
    return next(e)
  })
  // A subagent's turns are not this conversation's: they leave the wait alone.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) stopWaiting()
    return next(e)
  })
  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) stopWaiting()
    return next(e)
  })
}
```

Narsil also clears the wait in its `tool.call` hook, where another step starting means the wait was answered, and starts one for `AskUserQuestion` and `ExitPlanMode` there. The first guide shows a version of that hook.

## Common mistakes and how to test it

- **Starting a wait for asks nobody sees.** Under bypass permissions, or when a settings hook answers, no dialog appears. Check `result.decision` and `e.permission_mode` after `next(e)`.
- **Forgetting one way out.** A wait that is never cleared reminds you of something you answered long ago. List every path: allowed, failed, denied, another step, a new turn.
- **Insisting forever.** Without the `isNudged` flag, the heartbeat reminds you every two seconds after the fifth minute.
- **Relying on a timer across a reload.** `$.clock` timers die with a reload of the mod. A heartbeat that compares times is easier to reason about.
- **Blocking the heartbeat.** The reminder is sent with `void … .catch(...)`: a slow notification must not hold up the beat that also counts the cache.

To test, `claude plugin test .` runs `tests/narsil.test.tsx` with a mocked clock. "a permission left waiting five minutes is insisted on once, even while you look" raises a `classic.PermissionRequest`, finds no reminder at 4 minutes 50 seconds, then exactly one after ten more minutes, of kind `question`, with `force` set and the text "Sigo esperándote desde hace 5 min: pido permiso para usar Bash.". "a permission or question answered in time is not insisted on" answers after a minute and expects none.

## Going further

- `tickWatch` in `hooks/register.tsx` also sums the session up after 30 quiet minutes (`IDLE_SUMMARY_MS` and `summaryText` in `hooks/watch.ts`), shown like a tip.
- `announceQuestion` raises the first alert for the same three cases, and `setMood($, 'asking', ...)` puts the band in "TE NECESITA".
- The hub of guide 3 ranks a conversation that waits above one that works, so the reminder and the list agree on what matters.
