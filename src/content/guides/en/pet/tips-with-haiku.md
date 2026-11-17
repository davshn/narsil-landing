---
title: Tips with Haiku
description: 'How Narsil asks Haiku for one short tip about the work in progress: what context she sends, the exact prompt, how often she speaks up, the deep mode and the tip window.'
route: pet
order: 11
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/advice.ts
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: overlay/tip.ps1
  - repo: pet
    path: overlay/tip.sh
  - repo: pet
    path: overlay/tip.js
  - repo: pet
    path: docs/plan-advice.md
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## What it does

Now and then Narsil gives you a tip about what you are working on: two or three sentences, in Spanish, about something concrete that just happened. She asks a small model for it, Haiku, with a short summary of the work.

There are three automatic moments and two on demand:

- **A turn finished.** The tip reads what the turn changed and comments on one design decision: why it was done that way, what the alternative was, what each one gains or loses. Routine advice ("run the tests", "check the push") is ruled out on purpose.
- **A tool failed several times.** The same tool twice in one turn, or three failures of any kind. The tip is about debugging.
- **A turn has run for more than 3 minutes**, checked at each tool call. The tip is about pace, or about splitting the task.
- **`/narsil consejo`** ("tip") asks for one now, like the end-of-turn tip.
- **`/narsil consejo profundo`** ("deep tip") asks the session's own model, over the whole conversation.

Automatic tips are spaced out: at most one every 30 minutes by default (`/narsil consejos cada <min>` changes it), twice that when the same kind comes twice in a row, and at most 20 a day. A tip you ask for is never held back. `/narsil consejos off` stops the automatic ones, `/narsil consejos voz` reads the end-of-turn tips aloud, and the quiet mode (`/narsil discreto`) stops them along with the voice.

On Windows and macOS each tip opens whole in a small window of its own, with Narsil's picture, that does not take the focus and closes by itself after 3 minutes. Elsewhere it shows in the band, under the headline, in up to three short lines with a "×" to dismiss it, and in the floating window.

A tip never slows Claude down: it is asked for after the fact, while you read the answer.

## How it works inside

### What Narsil remembers: `seen`

`hooks/advice.ts` keeps the parts that are plain values (context, prompt, parsing); `hooks/register.tsx` owns the calls. What Narsil has seen of the work is one module variable, `seen`, filled by the hooks of the earlier guides:

- `prompt.submit`: your last message, its first 400 characters (not the messages the engine adds itself, `e.isMeta`).
- `tool.call`: the last 15 calls, each with its tool and the short detail of the band (a file's name, a command's first line); the files edited or written this turn, with how many times; and the last 5 failures, with the first 200 characters of the error.
- `turn.complete`: the turn's duration and Claude's final answer.
- Just before asking, `git`: what the turn changed (below).

Module variables are lost on a reload of the mod, and that is fine: the next turn fills them again. The plan says the same: "losing it on reload is harmless".

### What changed: the diff

For the end-of-turn tip and the one you ask for, `readDiff` runs `git diff HEAD --stat --patch --unified=2` through `$.process.run`, with a 5-second timeout. If the turn already committed everything and there is no pending diff, it reads the last commit instead (`git show HEAD`). Outside a repository, or without git, it is empty and the tip goes without it. A debugging or pacing tip does not read the diff at all: it has no use for it.

The first version of the tips had no diff: it arrived in `d1e6d40`, together with the rule against routine checks. With the diff, the model can name the function that changed instead of guessing from the list of tool calls.

### The context the model reads

`describe(seen, kind)` turns all of that into lines of text, with the reason first. A synthetic example of an end-of-turn context, shortened:

```text
Motivo: El turno acaba de terminar. Comenta una decisión de diseño de lo que se hizo: …
Último mensaje de la persona: añade reintentos a net.ts
Archivos editados en este turno: net.ts (2 veces), net.test.ts
Últimas herramientas usadas:
- Read: net.ts
- Edit: net.ts
- Bash: pnpm test
Duración del turno: 4 min
Respuesta final: Añadí retry() con tres intentos … Falta decidir el tiempo entre intentos.
Cambios (git):
 net.ts | 14 ++++++++++++--
 …
```

The labels are Spanish because the model must answer in Spanish: the last message, the files edited, the recent failures, the last tools, the duration, the final answer and the changes. Each part has its own limit: 1,500 characters of the answer, kept by both ends (`ends`), since an answer says what it did first and what is left last; 3,000 characters of the diff, cut by lines; 6,000 for the whole context. Then `sanitize` runs over it (below).

### The exact prompt

The system prompt is `SYSTEM` in `hooks/advice.ts`, quoted here as it is in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). `ASKED_TIP` is 300.

```ts
export const SYSTEM = [
  'Eres Narsil, una vieja serpiente marina sabia que acompaña a quien programa.',
  'Das UN consejo sabio y concreto sobre el trabajo en curso, el que daría alguien con experiencia que revisa el trabajo.',
  'Reglas:',
  `- Escribe en español, en dos o tres frases, como mucho ${ASKED_TIP} caracteres.`,
  '- Sigue el motivo que se te da. Cuando trate del diseño, nombra la decisión concreta (una función, un archivo, un enfoque),',
  '  la alternativa y por qué una u otra; el diff de los cambios te dice qué se hizo.',
  '- Menciona algo concreto del contexto; nada de motivación genérica ni datos inventados.',
  '- Puedes usar como mucho una metáfora del mar.',
  '- Habla como Narsil, en femenino; no nombres a ningún asistente ni a "Claude".',
  '- El femenino es solo para ti: a la persona háblale de tú con lenguaje neutro, sin suponer su género',
  '  (nada de "juntas", "juntos", "listo" o "lista"; di "contigo", "cuando quieras").',
  '- No repitas ninguno de los consejos anteriores.',
  '- Si no hay nada útil que decir, responde exactamente SKIP.',
  'Responde solo con el consejo (o SKIP), sin comillas ni prefijos.',
].join('\n')
```

In English: you are Narsil, a wise old sea serpent who keeps programmers company. You give ONE wise, concrete tip about the work in progress, the one an experienced reviewer would give. Rules: write in Spanish, in two or three sentences, 300 characters at most. Follow the reason you are given; when it is about design, name the concrete decision (a function, a file, an approach), the alternative and why one or the other; the diff tells you what was done. Mention something concrete from the context; no generic motivation, no invented data. At most one sea metaphor. Speak as Narsil, in the feminine; do not name any assistant or "Claude". The feminine is only for you: address the person informally in neutral language, without assuming their gender (the examples are Spanish words that carry gender, and neutral alternatives). Do not repeat any earlier tip. If there is nothing useful to say, answer exactly SKIP. Answer only with the tip (or SKIP), with no quotes or prefixes.

The user message is built by `prompt(context, recent)`: "Contexto del trabajo:" ("context of the work"), the context, then "Consejos anteriores (no los repitas):" ("earlier tips, do not repeat them") with the last five tips, and "Tu consejo:" ("your tip:") to close.

The reason that opens the context changes with the kind (`REASON` in `hooks/advice.ts`):

- **End of turn:** "El turno acaba de terminar." followed by the design instruction: comment on a design decision of what was done, why, what alternative there was and what each gains or loses, or how to improve that feature. Then "Nada de comprobaciones rutinarias (ejecutar los tests, revisar el push o el commit, mirar si el error ya no sale)." ("no routine checks: running the tests, checking the push or the commit, seeing whether the error is gone").
- **Failures:** "Una herramienta ha fallado varias veces: da un consejo para depurarlo." ("a tool has failed several times: give a tip to debug it").
- **Long turn:** "El turno lleva mucho tiempo: da un consejo de ritmo o de dividir la tarea." ("the turn has been going for a long time: give a tip about pace or splitting the task").

Three design choices in this prompt are worth copying. `SKIP` lets the model stay silent, and silence beats a useless tip. The earlier tips in the message stop the same advice coming back every turn. And the ban on routine checks exists because, without it, the cheapest tip is always "run the tests".

### Calling Haiku: `$.model.complete`

`askTip` sends it:

```tsx
const reply = await $.model.complete({
  model: 'haiku',
  system: SYSTEM,
  prompt: prompt(describe(seen, kind), recentTips),
  effort: 'medium',
  maxTokens: 2000,
  timeoutMs: 30_000,
})
return reply.isAnswered ? parse(reply.text) : null
```

The 2.1.325 types describe `$.model.complete` as one text completion through the session's own API client: "No tools, no history, no system prompt beyond the CLI's identity block and `request.system`". So Haiku sees only what Narsil sends, nothing of the conversation itself. The result says whether it answered (`isAnswered`); if not, a `reason` (`api-error`, `empty-reply`, `aborted`). Narsil treats any of those, and any exception, as "no tip".

`parse` cleans the reply: it drops surrounding quotes and a "consejo:" prefix, turns any "Claude" into "Narsil", returns nothing for `SKIP` or an empty reply, and cuts a runaway tip past 450 characters at its last full sentence. The prompt asks for 300; the margin is there because the model often writes a few more, and those show whole.

### The deep mode: `$.model.fork`

`/narsil consejo profundo` does something else. It calls `$.model.fork({ prompt: forkPrompt(recentTips) })`, where `forkPrompt` is the same `SYSTEM` followed by "Mira esta conversación hasta aquí y da tu consejo sobre ella." ("look at this conversation so far and give your tip about it").

The types describe a fork as one tool-less completion "over the session's OWN transcript as the main thread last sent it": the main thread's model, system prompt, tools and messages, with this prompt after them and every tool denied. The model sees everything, which is the point. When there is no conversation yet, the result's reason is `nothing-to-fork`, and Narsil answers that there is nothing to look at yet.

### When she may speak: `mayTip`

Each automatic trigger calls `tipLater($, kind)`, and each kind is tried at most once per turn. `mayTip` then decides:

1. Tips off, or the quiet mode: no.
2. Already 20 today: no. The day is counted as `Math.floor(now / 86_400_000)`, so it turns at midnight UTC, not local midnight.
3. Less than the interval since the last automatic tip: no. The interval is `adviceEveryMinutes` (30 by default), doubled when this kind is the same as the last one.
4. Otherwise yes, and the tip counts, even if the model then answers `SKIP`.

`tipLater` is never awaited: `void autoTip($, kind).catch(() => undefined)`. The hook that triggered it returns at once, so a slow model never holds up the turn. The plan asked for this, and also asked not to use `$.clock` timers, since a reload of the mod cancels them.

### Where the tip shows

`showTip` does the same for every tip:

1. It keeps the text among the last five, for the next prompt.
2. On Windows and macOS it opens the tip window. If that worked, the band and the floating window leave the tip out: it is already on screen, whole.
3. Otherwise the band draws it with `tipLines`, broken into at most three lines (60 characters on the desktop, the band's width on the terminal), with a "×" button. It leaves the band after 3 minutes; the floating window keeps it for 15, since that window is often looked at later.
4. It writes a log line, "💡" and the tip, with `$.ui.log`.

The tip window is not mod code: `launch` starts a script with `$.process.run`, detached, through `powershell.exe` on Windows and `/bin/sh` on macOS. On Windows, `overlay/tip.ps1` builds a small Windows Forms window that shows without taking the focus, stays on top, opens above the floating window when it is on screen (else in a corner of the screen Claude is on), closes after `NARSIL_SECONDS` (180) and closes any older tip. On macOS, `overlay/tip.sh` runs `overlay/tip.js` with `osascript` (JavaScript for Automation): a floating panel that never activates, placed above the floating window (it asks the local server where it is) or in the corner of the screen the mouse is on. Both have a button that goes back to the conversation through a `claude://` link, which they check against a strict pattern before opening it.

One detail in `tip.sh` matters for anyone copying it: "The tip and the rest travel in the environment, never inside the script, so nothing in them runs." The tip is text written by a model. Pasting it into a command line would let a stray quote turn it into code.

The `/compact` suggestion of guide 7 and the session summary of guide 10 also go through `showTip`, though no model writes them.

### Cost

Every tip is a model request on the person's account. The types say an answered `$.model.complete` "counts toward the session's cost total", visible in `/cost` with the `query_source` `plugin_model_complete`, and "Nothing caps it per call". The cap is Narsil's own: one every 30 minutes and 20 a day, which bounds the automatic tips to twenty small Haiku calls a day at most. Tips you ask for are not counted against it. The next steps of the next guide add at most one more call per finished turn.

The deep mode is different in kind. It runs the main model over the whole transcript. The types explain that the transcript is served from the prompt cache while it is warm, and "billed afresh once the entry lapsed": the cache clock of guide 8 tells you which case you are in. That is why it only runs when you ask.

### Privacy

The context goes to the same provider the session already uses, through the session's own client. Still, it is your code: your last message, file names, error text, Claude's answer and up to 3,000 characters of the diff.

`sanitize` runs over the whole context before it is sent. It replaces with "[oculto]" ("hidden") any `name=value` or `name: value` whose name contains key, token, secret or password, and any run of 32 or more base64 or hex characters. It is a heuristic: a secret in another shape gets through. If a repository must not be summarized to any model beyond the main conversation, turn the tips and the next steps off (`/narsil consejos off`, `/narsil pasos off`).

### Plan and code

`docs/plan-advice.md` says "Status: implemented", and most of it is. Some numbers moved later, and the code is what runs:

| Plan                                                    | Code today                                                                   |
| ------------------------------------------------------- | ---------------------------------------------------------------------------- |
| at most 160 characters, one or two sentences            | 300, two or three sentences (`69647da`, `d1e6d40`)                           |
| `effort: 'low'`, `maxTokens` ~120, `timeoutMs` ~8000    | `medium`, 2000, 30,000 (`d1e6d40`)                                           |
| context capped at ~2,000 characters, answer's first 400 | 6,000, answer 1,500 by both ends, plus the diff (`d1e6d40`)                  |
| one automatic tip every 10 minutes                      | every 30 (`1216dc4`)                                                         |
| one line in the band, cut at the end                    | up to three lines (`c564ab5`), or a window of its own (`c98adac`, `a95e96a`) |
| end-of-turn tip: what to check or do next               | a design decision, no routine checks (`d1e6d40`)                             |

The plan's sanitizing pattern is also narrower than the code's.

## How it was asked of the AI

The tips are the one feature of Narsil planned in a public document before the code was written: `docs/plan-advice.md`, added in `dd7027a` (2026-10-30) "docs: plan tips about the work in progress". It is a plan, not the author's words; the request that led to it was not recorded.

### What the plan says

The plan's goal:

> "Narsil, the mod's sea-serpent mascot, occasionally offers a short, wise, concrete tip about the work in progress: what Claude just did, the error it hit, the change it made."

And its choice between the two ways of asking a model, after a table comparing them:

> "Recommendation: automatic tips through `complete` with `haiku`; the transcript-aware `fork` only when the person asks for it."

That recommendation is what the code does today.

### Recorded: the tips stay as they are

When the author redesigned the band for every conversation, the request in `odd/tasks/fleet-view.md`, L1 (2026-11-06), ended with:

> "los consejos seguirian funcionando como ahora en cada ventana"

In English: the tips would keep working as now in each window. The task log records it as S10, "Tips unchanged", and the agreed design in L4 puts "the tip and next steps of this window below" the list.

### Reconstruction from the commit history

From `git log -- hooks/advice.ts docs/plan-advice.md overlay/tip.js overlay/tip.ps1 overlay/tip.sh`, with the related commits to `hooks/register.tsx`:

- `dd7027a` (2026-10-30) "docs: plan tips about the work in progress".
- `467a64b` (2026-10-30) "feat(advice): give short, concrete tips about the work in progress". The first version, following the plan.
- `e379f0e` (2026-10-30) "feat(advice): keep the tip in the floating window for 15 minutes".
- `c564ab5` (2026-10-30) "fix(band): break long tips into short lines".
- `71383d6` (2026-10-30) "fix(texts): agree state counts in number and keep advice gender-neutral toward the person". The rule in the prompt about the feminine being only Narsil's.
- `c98adac` (2026-10-31) "feat: open tips whole in their own window on Windows and give the band more room", then `a95e96a` (2026-10-31) "feat: open tips whole in their own window on macOS too".
- `69647da` (2026-11-01) "fix: show tips whole up to 320 characters, cutting a runaway one at its last sentence".
- `d1e6d40` (2026-11-04) "feat: make tips weigh design choices from the diff and next steps say what the project lacks". The biggest correction: its message says the end-of-turn tip "now reads the uncommitted diff (or the last commit) and comments on a design decision, an alternative and its tradeoff, instead of routine checks", with Haiku at medium effort and longer limits.
- `1216dc4` (2026-11-04) "feat: space automatic tips to one every 30 minutes by default". Stored preferences that still held the old default of 10 move to 30 once.

The pattern: a plan, a faithful first version, then corrections each time the tips proved too short, too frequent, or too generic.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> In my Claude Code mod `my-pet`, give one short tip about the work when a turn ends. Keep a small context in module variables: the last prompt from `prompt.submit`, the last 15 tool calls and the edited files from `tool.call`, and the final answer from `turn.complete`. When a main-conversation turn ends with `reason === 'answer'`, without awaiting it, read `git diff HEAD --stat --patch` with `$.process.run` (5 s timeout), build a context of at most 6,000 characters, remove anything that looks like a secret, and call `$.model.complete` with `model: 'haiku'`, a system prompt that asks for one concrete tip of at most 300 characters about a design decision in the diff, no routine checks, and the exact answer `SKIP` when there is nothing useful. Pass the last five tips and ask not to repeat them. Allow at most one tip every 30 minutes and 20 a day. Show the tip in the `AbovePrompt` band with a "×" button for 3 minutes. Test with `on('model.complete', ...)` mocking the model: the prompt contains the edited file's name, `SKIP` shows nothing, and an `API_KEY=` value never reaches the prompt.

## The minimal code

Written for this guide and checked against the 2.1.325 types (`$.model.complete`, `$.process.run`, `$.clock.now`, `$.ui.log`, `prompt.submit`, `turn.complete`, `ui.render`). It is adapted from `hooks/advice.ts` and `hooks/register.tsx` in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). The `tip` atom is declared in `types/index.d.ts` as in the first guide, with the type `{ text: string; at: number } | null`.

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const tip = atom({ plugin: 'my-pet', key: 'tip' } as const, null)
const SYSTEM = [
  'You give ONE concrete tip, at most 300 characters, about the work in progress.',
  'Comment on one design decision visible in the diff: the alternative and its tradeoff.',
  'No routine checks (running the tests, checking the push). Nothing invented.',
  'If there is nothing useful to say, answer exactly SKIP.',
].join('\n')
const EVERY_MS = 30 * 60_000
const SHOWN_MS = 3 * 60_000

let lastPrompt = ''
let lastTipAt: number | null = null
const recent: string[] = []

const sanitize = (text: string) =>
  text
    .replace(
      /[^\s"'`]*(key|token|secret|password)[^\s"'`]*\s*[:=]\s*("[^"]*"|'[^']*'|\S+)/gi,
      '[hidden]',
    )
    .replace(/[A-Za-z0-9+/_-]{32,}={0,2}/g, '[hidden]')

async function diff($: EngineInterface): Promise<string> {
  try {
    const r = await $.process.run(['git', '--no-pager', 'diff', 'HEAD', '--stat', '--patch'], {
      timeoutMs: 5000,
    })
    return r.exitCode === 0 ? r.stdout.slice(0, 3000) : ''
  } catch {
    return ''
  }
}

async function autoTip($: EngineInterface, answer: string): Promise<void> {
  const now = await $.clock.now()
  if (lastTipAt !== null && now - lastTipAt < EVERY_MS) return
  lastTipAt = now
  const context = sanitize(
    `Last message: ${lastPrompt}\nFinal answer: ${answer.slice(0, 1500)}\nChanges:\n${await diff($)}`,
  ).slice(0, 6000)
  const before = recent.length
    ? `\n\nEarlier tips (do not repeat):\n${recent.map((t) => `- ${t}`).join('\n')}`
    : ''
  const reply = await $.model.complete({
    model: 'haiku',
    system: SYSTEM,
    prompt: `Context:\n${context}${before}\n\nYour tip:`,
    effort: 'medium',
    timeoutMs: 30_000,
  })
  if (!reply.isAnswered) return
  const text = reply.text.trim()
  if (!text || /^skip\b/i.test(text)) return
  recent.push(text)
  if (recent.length > 5) recent.shift()
  await update($, tip, () => ({ text, at: now }))
  $.ui.log(`💡 ${text}`)
}

export const register: Register = (on) => {
  on('prompt.submit', async ($, e, next) => {
    if (!e.isMeta) lastPrompt = e.text.slice(0, 400)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    // Never awaited: the tip must not slow the turn.
    if (e.agentId === undefined && e.reason === 'answer')
      void autoTip($, e.answer).catch(() => undefined)
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const shown = await read($, tip)
    if (!shown || (await $.clock.now()) - shown.at > SHOWN_MS) return next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="row" gap={1} minWidth={0}>
        <Text wrap="truncate-end">{`💡 ${shown.text}`}</Text>
        <Button key="tip-dismiss" label="×" onPress={() => update($, tip, () => null)} />
      </Box>
    )
  })
}
```

The band here checks the age of the tip when it draws. Narsil instead marks the tip faded on its heartbeat, so the band redraws when the three minutes are over and not only at the next render.

## Common mistakes and how to test it

- **Awaiting the model in the hook.** A `turn.complete` hook that awaits a completion holds the turn's end for as long as the model takes. Start it and return.
- **No way to stay silent.** Without `SKIP`, the model always finds something to say, and most of it is filler.
- **Sending the conversation to a cheap model by accident.** `$.model.complete` sends only what you put in it. Decide field by field what leaves, cap each one, and sanitize the whole.
- **Running the model's text as code.** The tip windows receive the text through the environment, never inside a script or a command line.
- **No cap on frequency.** Each tip is a billed request. Put a minimum interval and a daily cap in the mod; nothing in the engine adds one.
- **Trusting the plan over the code.** If you copy from `docs/plan-advice.md`, check the numbers against `hooks/advice.ts`: several changed.

To test, `claude plugin test .` runs `tests/narsil.test.tsx`, which answers the model with `on('model.complete', ...)` and `on('model.fork', ...)`, so no real request is made. Tests worth reading: "a finished turn's tip weighs a design choice of the turn, from its diff, with Haiku at medium effort", "SKIP or an empty reply shows nothing", "with the default, a second tip waits 30 minutes", "two failures of the same tool give one debugging tip", "/narsil consejo profundo asks over the conversation itself", "a secret never reaches the prompt sent to the model" and "a failed, timed-out or rejected model call shows nothing and breaks nothing". The tip windows have their own: "on Windows a tip opens whole in its own window, and leaves the band and the floating window free" and "on macOS a tip opens whole in its own window too, through tip.sh, detached".

## Going further

- `adviceCommand` in `hooks/register.tsx` handles every `/narsil consejo…` command; `setAdvice` stores the preferences with `$.store`.
- The migration of the stored default from 10 to 30 minutes (`ADVICE_MIGRATED_KEY`) moves an old 10 once and keeps a 10 chosen afterwards.
- `lines` in `hooks/advice.ts` breaks a tip into lines and cuts a word longer than a line, such as a path or a URL.
- The next guide reuses the same context, the same `describe` and the same model call to propose next steps.
