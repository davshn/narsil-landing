---
title: Next steps
description: "How Narsil proposes up to three next steps 15 minutes after a turn, from the project's commits, its uncommitted changes and its pending tasks, and puts the one you pick in the prompt."
route: pet
order: 12
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: hooks/advice.ts
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## What it does

You finish a turn, read the answer, and step away. When you come back, the question is often the same: what now?

Fifteen minutes after a turn ended, if you have not written anything since, Narsil proposes up to three next steps. In the band they appear under their own line:

```text
➜ ¿Y ahora? Elige uno y te lo dejo en el prompt:
[ Añade reintentos con backoff a net.ts ]  [ Documenta el modo oscuro en el README ]
```

"And now? Pick one and I will leave it in the prompt." (The terminal shows only "➜ ¿Y ahora?".) Each step is a button, and each is a request written in the imperative, ready to send as it is. The example in the README is "Añade reintentos con backoff a net.ts" ("add retries with backoff to net.ts").

Pressing a step does not send it. It puts the text in the prompt box as a draft, for you to read, change and send yourself. The other steps go away.

The README says the steps answer two questions: "¿cómo seguimos con el proyecto?" and "¿qué nos falta por hacer?" ("how do we go on with the project?" and "what do we have left to do?"). To answer them, Narsil reads the last commits, the files without a commit and, if the project has them, the pending tasks in `odd/tasks/*.md`.

The floating window shows the steps too. `/narsil pasos off` ("steps off") turns them off, and the quiet mode leaves them out.

## How it works inside

### Fifteen minutes from the end of the turn

The next steps have no timer of their own. They ride on the cache clock of guide 8: when a turn of the main conversation ends, `startCache` writes the `cache` atom with `at`, the moment the turn ended. On every two-second heartbeat, `tickCache` counts the cache down and also checks:

```tsx
if (now - c.at >= STEPS_AFTER_MS) void offerSteps($, c.at).catch(() => undefined)
```

`STEPS_AFTER_MS` is 15 minutes. "If you have not written anything" needs no extra state: a new prompt starts a turn, `turn.start` clears both the cache clock and any steps on offer, and there is no `at` left to count from.

The steps count from the end of the turn, `at`, not from the start of its last request as the cache does. The cache clock guide explains the difference: the cache is about the API, and the steps are about you being away. A test pins it: "next steps still wait from the end of the turn, however long its last request took".

The wait was 3 minutes at first. Commit `2bcc97c` moved it to 15 in a commit titled "calm loop, steps and permission alerts", the same one that moved the permission reminder of guide 10 from 2 to 5 minutes.

### Once per finished turn

`offerSteps` asks at most once for each turn. It returns early when:

- it already asked for this `at` (`stepsAskedFor`), or steps for this `at` are on show;
- the turn stopped with background work still running (guide 1): the work is not over, so it is not the moment to ask what comes next;
- the steps are off, or the quiet mode is on.

It marks the turn as asked before it checks the preferences. Turning the steps on later does not bring steps for a turn that already passed; they come with the next one.

### What the model reads

The steps reuse the tips' context of guide 11: the same `seen`, the same `describe`, the same `sanitize`, with the reason "Propón cómo seguir con el proyecto: qué falta por hacer, qué mejorar o qué funcionalidad viene después." ("propose how to go on with the project: what is left to do, what to improve or which feature comes next").

Two parts are read just before asking. `readDiff` gives what the turn changed, as for the end-of-turn tip. `readProject` gives where the project stands, three parts with `git` and the file system:

- `git log --oneline --no-decorate -10`: the last ten commits.
- `git status --short`: the files without a commit.
- Up to five `.md` files in `odd/tasks`, listed with `$.fs.list` and read with `$.fs.read`. A relative path is under the session's working directory, as the 2.1.325 types say.

From each task file, `pendingTasks` keeps only what is unfinished: unticked `- [ ]` lines, and lines under a `## Tasks` heading that say pending, pendiente, todo or in progress. Ticked items and everything under a `Log` heading stay out. The format is the one the author's own task files use; a project without such files still gets its commits and its status.

The project part is capped at 2,000 characters and the diff at 3,000, inside the same 6,000-character context. Only the steps read the project; a tip never does.

### The exact prompt

`STEPS_SYSTEM` in `hooks/advice.ts`, quoted as it is in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). `MAX_STEPS` is 3, `MAX_STEP` is 90, and `NO_ROUTINE` is the same ban on routine checks the tips use.

```ts
export const STEPS_SYSTEM = [
  'Eres Narsil, una vieja serpiente marina sabia que acompaña a quien programa.',
  'El turno terminó hace unos minutos: propón los próximos pasos que la persona podría pedir ahora.',
  'Responden a "¿cómo seguimos con el proyecto?" y "¿qué nos falta por hacer?": la siguiente tarea pendiente,',
  'una funcionalidad que completa lo que se hizo, o una mejora de diseño que vale la pena.',
  'Reglas:',
  `- Entre uno y ${MAX_STEPS} pasos, uno por línea, en español, como mucho ${MAX_STEP} caracteres cada uno.`,
  '- Cada paso es una petición en imperativo que se le puede enviar tal cual (por ejemplo: "Añade reintentos con backoff a net.ts").',
  `- ${NO_ROUTINE}`,
  '- Concretos y sacados del contexto: las tareas pendientes, los commits recientes, los archivos sin commit; nada inventado.',
  '- Usa lenguaje neutro, sin suponer el género de la persona; no nombres a ningún asistente ni a "Claude".',
  '- Si no hay nada útil que proponer, responde exactamente SKIP.',
  'Responde solo con los pasos (o SKIP), sin comillas ni introducción.',
].join('\n')
```

In English: you are Narsil, a wise old sea serpent who keeps programmers company. The turn ended a few minutes ago: propose the next steps the person could ask for now. They answer "how do we go on with the project?" and "what do we have left to do?": the next pending task, a feature that completes what was done, or a design improvement worth making. Rules: between one and 3 steps, one per line, in Spanish, 90 characters at most each. Each step is a request in the imperative that can be sent as it is (for example: "add retries with backoff to net.ts"). No routine checks (running the tests, checking the push or the commit, seeing whether the error is gone). Concrete and taken from the context: the pending tasks, the recent commits, the files without a commit; nothing invented. Use neutral language, without assuming the person's gender; do not name any assistant or "Claude". If there is nothing useful to propose, answer exactly SKIP. Answer only with the steps (or SKIP), with no quotes or introduction.

The user message is `stepsPrompt(context)`: "Contexto del trabajo:", the context, and "Próximos pasos:" ("next steps:") to close. The call is the tips' own: `$.model.complete` with `model: 'haiku'`, `effort: 'medium'`, `maxTokens: 2000` and `timeoutMs: 30_000`.

Asking for imperatives that "can be sent as they are" is the design decision that makes the click work: a step is already a prompt, so filling the box with it needs no rewriting.

### Reading the reply

`parseSteps` turns the reply into a list: nothing for `SKIP`; otherwise one step per line, without bullets, numbers or quotes, with any "Claude" turned into "Narsil", at most three, each cut to 90 characters with "…".

Then one last check: if the `cache` atom no longer has the same `at`, a new turn started while the model was answering, and the steps are stale. They are dropped.

Otherwise they are written to the `steps` atom with their `at`, logged with `$.ui.log` ("➜ Narsil propone: …", "Narsil proposes"), and pushed to the floating window. Any failure (git, the files, the model) ends in a `catch`: no steps this time.

### Filling the prompt on click

Each step is drawn as a `Button` whose `onPress` calls `pickStep`:

```tsx
async function pickStep($: EngineInterface, step: string): Promise<void> {
  await $.prompt.fill({ text: step })
  await update($, steps, () => null)
  await pushOverlay($)
}
```

The 2.1.325 types describe `$.prompt.fill` as putting `input.text` "in the prompt box as the draft", by `mode`: `replace` by default, `append` after the draft, `insert` at the cursor. Two consequences follow from the code:

- With no `mode`, a step replaces whatever draft you had in the box.
- The types say the result is `isFilled: false` "under a dialog or headless". Narsil does not read the result: it clears the steps either way. The README describes only the normal case.

Why fill instead of send? A step comes from a small model reading a summary. Sending it would start a turn you did not choose, on your account. Filling the box keeps you as the one who decides, and lets you edit the step first.

### The steps stand alone in the band

When steps arrive, `offerSteps` also closes every open conversation in the band's list (guide 3), so the steps are seen on their own. The comment in the band's render explains the rule: "Next steps on offer close every conversation until you open one: then they hide, and come back once you close them all." This came in `250d2c6`, "let next steps stand alone".

## Build it with Claude

Ask Claude to propose next steps after a quiet pause, built from the project's recent commits, its files without a commit and its pending tasks. The one idea it must get right is that a step goes into the prompt box as a draft and is never sent: you stay the one who decides.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> In my Claude Code mod `my-pet`, propose next steps after a quiet pause. In `turn.complete`, for the main conversation, record when the turn ended in an atom; clear it and any steps on offer in `turn.start`. On a `$.clock.every(2000, ...)` heartbeat, once 15 minutes have passed since that moment and only once per turn, read `git log --oneline -10` and `git status --short` with `$.process.run` and the unticked `- [ ]` lines of `odd/tasks/*.md` with `$.fs.list` and `$.fs.read`. Call `$.model.complete` with `model: 'haiku'` and a system prompt that asks for one to three imperative requests, 90 characters at most each, that can be sent as they are, taken from that context, or exactly `SKIP`. Drop the reply if a new turn started meanwhile. Show each step as a `Button` in the `AbovePrompt` band; on press, call `$.prompt.fill({ text })` and clear the steps only when `isFilled` is true. Test with a mocked clock and `on('model.complete', ...)`: nothing at 14 minutes, steps at 15, and the pressed step reaching a `prompt.fill` hook.

### What to check in Claude's answer

1. The pause counts from the moment the turn ended, and `turn.start` clears it and any steps on offer.
2. The model is asked at most once per turn, even though the heartbeat runs every two seconds.
3. After the model answers, the code checks that no new turn started meanwhile, and drops the steps if one did.
4. Only unticked `- [ ]` lines of the task files reach the model; ticked items stay out.
5. Pressing a step calls `$.prompt.fill` and never sends it, and the steps are cleared only when `isFilled` is true.

If a check fails, tell Claude what you see: "after 15 minutes the steps change every two seconds".

### How the author asked for it

The original request for the next steps was not recorded. They arrived on 2026-10-30, in the same commit as the cache clock, before the public task logs. `docs/plan-advice.md`, the plan for the tips, does not mention them.

#### Recorded: where they go

The agreed design for the band with every conversation, `odd/tasks/fleet-view.md` in narsil-pet, L4, places them: "the tip and next steps of this window below" the list. L4 is the design as agreed, written down in the log, not the author's own words.

#### Reconstruction from the commit history

From `git log -- hooks/register.tsx hooks/advice.ts`:

- `0993bd7` (2026-10-30) "feat: show a prompt-cache clock and offer next steps after a turn". The steps and the clock arrive together, both started by the end of a turn.
- `d1e6d40` (2026-11-04) "feat: make tips weigh design choices from the diff and next steps say what the project lacks". Its message: "Next steps read recent commits, git status and pending odd/tasks items to answer how the project goes on." `readProject`, `pendingTasks` and the two questions of the prompt come from here.
- `2bcc97c` (2026-11-05) "feat: open the context breakdown from the usage bars and calm loop, steps and permission alerts". Its message: "next steps wait 15 minutes" (they waited 3).
- `250d2c6` (2026-11-07) "feat: open the context from its percent and let next steps stand alone".
- `c3e4464` (2026-11-09) "fix: count the prompt cache from the start of its last request". The cache moved to the request's start; the steps kept counting from the end of the turn.

The corrections follow one direction: from steps that came too soon and said too little, to steps that wait for a real pause and read the project's own plan.

## Reference code

This is one correct answer, written for this guide. Read it to understand how the pieces fit together and to compare it with what Claude wrote for you: Claude may choose other names or another order and still be right.

Written for this guide and checked against the 2.1.325 types (`$.model.complete`, `$.process.run`, `$.fs.list`, `$.fs.read`, `$.prompt.fill` and its `isFilled`, `$.clock.every`, `turn.start`, `turn.complete`, `ui.render`). It is adapted from `hooks/advice.ts` and `hooks/register.tsx` in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). The `ended` atom (`number | null`) and the `steps` atom (`{ at: number; items: string[] } | null`) are declared in `types/index.d.ts` as in the first guide.

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const ended = atom({ plugin: 'my-pet', key: 'ended' } as const, null)
const steps = atom({ plugin: 'my-pet', key: 'steps' } as const, null)
const AFTER_MS = 15 * 60_000
const SYSTEM = [
  'Propose one to three next steps for this project, one per line, at most 90 characters each.',
  'Each one is an imperative request that can be sent as it is.',
  'Take them from the context (pending tasks, recent commits, uncommitted files); nothing invented.',
  'No routine checks. If there is nothing useful, answer exactly SKIP.',
].join('\n')
let askedFor: number | null = null

async function git($: EngineInterface, args: string[]): Promise<string> {
  try {
    const r = await $.process.run(['git', '--no-pager', ...args], { timeoutMs: 5000 })
    return r.exitCode === 0 ? r.stdout.trim() : ''
  } catch {
    return ''
  }
}

async function pending($: EngineInterface): Promise<string[]> {
  try {
    const files = (await $.fs.list('odd/tasks')).filter(
      (f) => f.kind === 'file' && f.name.endsWith('.md'),
    )
    const out: string[] = []
    for (const f of files.slice(0, 5)) {
      const text = await $.fs.read(`odd/tasks/${f.name}`)
      if (typeof text !== 'string') continue
      for (const line of text.split('\n')) {
        const m = /^\s*[-*]\s+\[ \]\s+(.*)$/.exec(line)
        if (m) out.push(m[1]!)
      }
    }
    return out
  } catch {
    return []
  }
}

async function offer($: EngineInterface, at: number): Promise<void> {
  if (askedFor === at) return
  askedFor = at
  const context = [
    `Recent commits:\n${await git($, ['log', '--oneline', '--no-decorate', '-10'])}`,
    `Uncommitted:\n${await git($, ['status', '--short'])}`,
    `Pending tasks:\n${(await pending($)).map((t) => `- ${t}`).join('\n')}`,
  ]
    .join('\n')
    .slice(0, 2000)
  const reply = await $.model.complete({
    model: 'haiku',
    system: SYSTEM,
    prompt: `Context:\n${context}\n\nNext steps:`,
    effort: 'medium',
    timeoutMs: 30_000,
  })
  if (!reply.isAnswered || /^\s*skip\b/i.test(reply.text)) return
  const items = reply.text
    .split('\n')
    .map((l) => l.trim().replace(/^([-*•]|\d+[.)])\s*/, ''))
    .filter(Boolean)
    .slice(0, 3)
    .map((s) => (s.length > 90 ? `${s.slice(0, 89)}…` : s))
  // A turn that started meanwhile makes them stale.
  if (items.length === 0 || (await read($, ended)) !== at) return
  await update($, steps, () => ({ at, items }))
}

async function beat($: EngineInterface): Promise<void> {
  const at = await read($, ended)
  if (at !== null && (await $.clock.now()) - at >= AFTER_MS)
    void offer($, at).catch(() => undefined)
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    $.clock.every(2000, () => void beat($))
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      await update($, ended, () => null)
      await update($, steps, () => null)
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined && e.reason === 'answer') {
      const now = await $.clock.now()
      await update($, ended, () => now)
    }
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const offered = (await read($, steps))?.items ?? []
    if (offered.length === 0) return next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    const pick = (step: string) => async () => {
      const { isFilled } = await $.prompt.fill({ text: step })
      if (isFilled) await update($, steps, () => null)
    }
    return (
      <Box flexDirection="row" gap={1} flexWrap="wrap" minWidth={0}>
        <Text dimColor>➜ And now?</Text>
        {offered.map((step, i) => (
          <Button key={`step-${i}`} label={step} onPress={pick(step)} />
        ))}
      </Box>
    )
  })
}
```

Unlike Narsil, this version keeps the steps when the box could not be filled, so a press under a dialog can be repeated.

## Common mistakes and how to test it

- **Steps for a turn that is no longer the last.** The model takes seconds; a new prompt may arrive meanwhile. Compare the turn's moment again after the reply, as `offerSteps` does.
- **Asking on every heartbeat.** The check runs every two seconds. Without a per-turn mark (`stepsAskedFor`), each beat after the fifteenth minute would ask the model again.
- **Sending instead of filling.** A step proposed by a small model should reach the box, not the model. Let the person press Enter.
- **Replacing a draft without meaning to.** `$.prompt.fill` replaces the draft by default. If you want to keep it, pass `mode: 'append'` or `mode: 'insert'`.
- **Reading the whole task file.** Done tasks and the log only add noise and length. Keep the unfinished lines, as `pendingTasks` does.
- **Counting from the last request.** The steps are about a pause in your work; count from the end of the turn.

To test, `claude plugin test .` runs `tests/narsil.test.tsx` with a mocked clock, the model answered by `on('model.complete', ...)` and the prompt box by `on('prompt.fill', ...)`. "a few minutes after a turn Narsil offers next steps, and one click puts it in the prompt" finds no steps at 14 minutes, three at 15, checks that they close the conversations and hide when one is opened, presses the second one and expects exactly its text in the box, and checks that a turn is asked once. "a new turn before the minutes pass, or /narsil pasos off, offers no next steps" and "the next steps ask how the project goes on, from its log, its status and its pending tasks" cover the rest; the last one checks that a ticked task and the log never reach the prompt.

## Going further

- `stepsCommand` in `hooks/register.tsx` handles `/narsil pasos on` and `off`, next to `/narsil cache`.
- `shownState` sends the steps to the hub, so the floating window shows them with the conversation; the phone state leaves them out for other conversations.
- `pendingTasks` in `hooks/advice.ts` also reads tasks in a table under `## Tasks`, by the words pending, pendiente, todo or in progress, so a task log written as a table works too.
- With the tips of guide 11 and this guide, every model call Narsil makes goes through `$.model.complete` with Haiku, except the deep tip, which forks the session.
