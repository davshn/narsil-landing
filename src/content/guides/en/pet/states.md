---
title: States at a glance
description: "How Narsil turns the session's events into five states, one sentence about the current step and a short comment, drawn in the band above the prompt."
route: pet
order: 1
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: hooks/sprite.ts
  - repo: pet
    path: types/index.d.ts
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## What it does

Narsil lives in the band directly above the prompt. One look at it answers the question you ask most often while Claude works: do I need to do anything right now?

The band shows three things:

- **A state**, in capitals and in its own color. Narsil speaks Spanish, so the labels are Spanish:

  | Label         | Meaning               | When it shows                                                        |
  | ------------- | --------------------- | -------------------------------------------------------------------- |
  | `TRABAJANDO`  | Working               | Claude is thinking, reading, searching, editing or running commands. |
  | `PARADA`      | Idle, waiting for you | The conversation is waiting for your next message.                   |
  | `TE NECESITA` | Needs you             | A question, a plan to approve or a permission to decide.             |
  | `TERMINADA`   | Done                  | Claude finished its answer.                                          |
  | `ERROR`       | Error                 | The turn stopped because something failed.                           |

- **A sentence that says exactly what Claude is doing**, such as "Estoy editando: register.tsx" ("I am editing: register.tsx") or "Te necesito: tengo una pregunta para ti" ("I need you: I have a question for you").
- **Narsil's own comment** under that sentence, picked at random from a few lines per moment, such as "Tecleando con mis aletas." ("Typing with my fins.") while a file is edited.

Outside the terminal the band also draws Narsil herself, in a pose for each state (the next guide covers the drawing). On the terminal it draws a small text face instead, such as `~(•ᴗ•)~ 💻`.

The value is that you do not have to read the transcript to know where things stand. A yellow `TE NECESITA` is a reason to come back; a blue `TRABAJANDO` is a reason to keep doing something else.

## How it works inside

The state is not something Claude Code hands to a mod. Narsil builds it herself from the events of the session, keeps it in one value, and draws that value.

### One value, two layers: mood and status

The mod keeps a single state value, the `pet` atom in `hooks/register.tsx`, with three fields: `mood`, `detail` and `line`. Its type, `Pet`, is declared in `types/index.d.ts`.

`mood` is finer than the five states. There are twelve moods: `greeting`, `idle`, `thinking`, `talking`, `reading`, `searching`, `writing`, `running`, `asking`, `scared`, `celebrating` and `failed`. The five states are derived from the mood by `statusOf` in `hooks/sprite.ts`:

- `greeting` and `idle` are idle (`PARADA`).
- `asking` is waiting (`TE NECESITA`).
- `celebrating` is done (`TERMINADA`).
- `failed` is error (`ERROR`).
- Every other mood is working (`TRABAJANDO`), including `scared`.

The reason for two layers is that the state answers "do I need to act?", and five answers are enough for that; the mood answers "what exactly is happening?", which drives the sentence, the comment and the pose. Keeping only the mood and deriving the state means the two can never disagree.

The `scared` mood is a good example of why the split matters. When one tool call fails in the middle of a turn, Narsil looks startled and the sentence says "Ha fallado un paso (Bash); sigo trabajando" ("A step failed (Bash); I keep working"). The state stays `TRABAJANDO`, because Claude is still working and nothing is asked of you. Only a turn that ends in failure becomes `ERROR`.

### The events Narsil listens to

Every change of mood goes through one function, `setMood` in `hooks/register.tsx`, which writes the `pet` atom and pushes the new state to the floating window. The hooks that call it:

- **`session.start`**: a new conversation starts as `greeting`, which counts as idle.
- **`turn.start`**: your prompt starts a turn; the mood becomes `thinking`. The hook acts only when `e.agentId` is undefined, so a subagent's turn does not reset the main conversation.
- **`turn.step`**: the model's output streams in chunks. A `thinking` chunk keeps the mood at `thinking`; the first `text` chunk of the main loop switches it to `talking` ("Estoy escribiendo la respuesta", "I am writing the answer"). This hook is an async generator: it yields every chunk it receives, so the stream reaches the screen unchanged.
- **`tool.call`**: the most informative event. The tool's name picks the mood through `MOOD_BY_TOOL` in `hooks/words.ts` (`Read` is reading, `Grep` and `WebSearch` are searching, `Edit` and `Write` are writing, `Bash` and `PowerShell` are running), and `describeCall` turns the call's input into the short detail after the colon: the file's base name for a file tool, the pattern for a search, the first line of a command. `AskUserQuestion` and `ExitPlanMode` are handled apart (`ASKING_TOOLS`): they set `asking`, because the tool itself is the moment Claude stops and waits.
- **`classic.PermissionRequest`**: a permission dialog that you have to answer. The hook calls `next(e)` first and sets `asking` only when no settings hook already decided it and the mode is not `bypassPermissions`.
- **`turn.complete`**: the turn ends, and `e.reason` decides the state. `answer` becomes `celebrating` with the time it took ("He terminado (en 2 min)"), `aborted` goes back to `idle` with "lo has detenido tú" ("you stopped it"), and any other reason becomes `failed`.

### Why each decision was taken

The comments in `hooks/register.tsx` give the reasons, and they are worth reading as design notes:

- **Permissions use `classic.PermissionRequest`, not `tool.check`.** The comment explains that `tool.check`'s `ask` comes before the permission mode settles the call, so under "bypass permissions", a rule or the auto classifier, Narsil would "cry wolf". The engine raises `PermissionRequest` only when it is about to show you the dialog.
- **A finished turn is not always "done".** In the `classic.Stop` hook Narsil counts the background tasks still running (`e.background_tasks`). If there are any, `turn.complete` shows her still `running` and waiting for them, instead of announcing a finish that is not real.
- **A question in the desktop app's next-step box is a question.** When a turn ends with the desktop app's `mcp__ccd_turn__wrap_up` tool carrying an `ask`, the `tool.call` hook keeps that text (`turnAsk`), and `turn.complete` shows `asking` with it instead of `celebrating`.
- **Only Claude's own calls move her.** `tool.call` starts with `isClaudesCall(next.origin)` (in `hooks/watch.ts`): another mod's call, such as narsil-check reading its session at start, is not Claude's work.
- **The words live in one file.** `hooks/words.ts` holds every label (`STATUS_LABEL`), the sentence builder (`headline`), the comments (`LINES` and `pick`) and the tool table. The hooks module decides what happened; `words.ts` decides how it is said. That keeps the labels identical everywhere they appear: the band, the floating window, the phone and `/narsil estado`.
- **Narsil speaks in the first person.** The sentences are written as Narsil talking ("Estoy leyendo", "I am reading"), a choice recorded in the commit history (see below).

### What the band draws

The `ui.render` hook for `{ component: 'AbovePrompt' }` reads the state and returns a tree of `Box`, `Text`, `Button` and `Svg` elements from `$.ui.resolve(e)`. It yields to a survey (`e.props.hasSurvey`) and to `/narsil ocultar`.

On the terminal it draws one line: the text face from `FACE`, the label in bold in its color, and the sentence. On the other surfaces it draws the picture through `Svg` at 132 by 118 pixels, and a column beside it with `● LABEL · Narsil · level`, the sentence in bold and the comment dimmed. The colors come from `STATUS_COLOR` in `hooks/sprite.ts`: blue `#3B8BFF` for working, grey for idle, yellow `#F5B400` for needs you, green for done and red for error.

Every text that can grow is drawn with `wrap="truncate-end"` inside a box with `minWidth={0}`, so a long file name is cut inside the band instead of widening it.

The band you see today draws the most important of all your open conversations, not only the current one; the third guide in this path explains that part. When the conversation it shows is another one, the sentence starts with that conversation's name, and the comment is left out.

## Build it with Claude

Ask Claude for a mod that keeps one state value, sets it from the session's events and draws it in the band above the prompt. The one idea it must get right is that only the main conversation moves that state: events from a subagent carry an `agentId`, and the hooks leave the state alone for them.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the prompt used to build Narsil.

> Build a Claude Code mod called `my-pet` that shows the conversation's state in the band above the prompt (`ui.render` on `AbovePrompt`). Keep one state value in an atom with a status (working, idle, waiting, done, error) and a one-line headline. Set it from `turn.start` (working), `tool.call` (working, with the tool and the file's base name in the headline; waiting for `AskUserQuestion` and `ExitPlanMode`) and `turn.complete` (done on `answer`, idle on `aborted`, error otherwise). Ignore events whose `agentId` is set. Draw the label in bold in its color and the headline after it, truncated so it never widens the band. Check every API against the plugin-authoring types, declare the atom in `types/index.d.ts`, and add a test with `claude-code/testing` that a `Read` call shows the file name.

### What to check in Claude's answer

1. Every hook that only observes ends by calling `next(e)`, and `turn.complete` awaits `next(e)` before it reads `e.reason`.
2. `turn.start`, `tool.call` and `turn.complete` check `e.agentId` and change nothing when it is set.
3. `AskUserQuestion` and `ExitPlanMode` set the waiting state, and `turn.complete` turns `answer` into done, `aborted` into idle and any other reason into error.
4. The headline is drawn with `wrap="truncate-end"` inside a box with `minWidth={0}`, so a long file name does not widen the band.
5. The render hook returns `next(e)` when `e.props.hasSurvey` is true.

If a check fails, tell Claude what you see: "the band goes back to WORKING when a subagent starts, after the answer was already done".

### How the author asked for it

The original request for the states was not recorded. The project's public task logs (`odd/tasks/fleet-view.md` and `odd/tasks/animated-poses.md`) start later, and neither covers the first band.

#### Reconstruction from the commit history

From `git log -- hooks/register.tsx hooks/words.ts` in narsil-pet:

- `b1187f3` (2026-10-30) "feat: show Narsil above the prompt with clear states and /narsil". The band, its states and the `/narsil` command arrive together in the first commit of the hooks module.
- `8e29583` (2026-10-30) "fix(band): keep long text from widening the desktop band". The `minWidth={0}` and truncation rule above comes from here.
- `2027f06` (2026-10-30) "fix(alerts): only alert when a permission dialog needs your answer". The move to `classic.PermissionRequest`, explained in the code comment quoted above.
- `0cfc369` (2026-10-31) "refactor: move Narsil's wording and labels out of the hooks module". This is when `hooks/words.ts` was born.
- `c73bc13` (2026-10-31) "feat: let Narsil speak of herself in the first person", followed by `36256f9` "feat: let the band, window and alerts speak in Narsil's first person".
- `2532e7c` (2026-11-02) "feat: alert as a question when a turn ends asking in the desktop app's next-step box".
- `519dd73` (2026-11-06) "fix: wait for background work before announcing a turn finished". Its message says a turn that stops with background shells, monitors or subagents still running now shows Narsil waiting for them.

The pattern is clear even without the prompts: a first version that mapped events to states, then a series of corrections each time a state lied (a false alarm, a false finish, a missed question).

## Reference code

This is one correct answer, written for this guide. Read it to understand how the pieces fit together and to compare it with what Claude wrote for you: Claude may choose other names or another order and still be right.

This is a reduced version of the idea, written for this guide and checked against the Claude Code 2.1.325 types. It is adapted from `hooks/register.tsx`, `hooks/words.ts` and `hooks/sprite.ts` in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later); the colors are Narsil's `STATUS_COLOR`.

The state's type, in `types/index.d.ts` (named by `"types"` in `plugin.json`):

```ts
export type Status = 'working' | 'idle' | 'waiting' | 'done' | 'error'
export type Pet = { status: Status; headline: string }

declare module 'claude-code' {
  interface PluginState {
    'my-pet': { pet: Pet }
  }
}
```

The hooks module, `hooks/register.tsx`:

```tsx
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'
import type { Status } from '../types'

const LABEL: Record<Status, string> = {
  working: 'WORKING',
  idle: 'IDLE',
  waiting: 'NEEDS YOU',
  done: 'DONE',
  error: 'ERROR',
}
const COLOR: Record<Status, string> = {
  working: '#3B8BFF',
  idle: '#8A90A6',
  waiting: '#F5B400',
  done: '#22B573',
  error: '#F0435A',
}
const VERB: Record<string, string> = {
  Read: 'reading',
  Grep: 'searching',
  Edit: 'editing',
  Write: 'editing',
  Bash: 'running',
}

const pet = atom({ plugin: 'my-pet', key: 'pet' } as const, {
  status: 'idle',
  headline: 'Waiting for your message',
})

export const register: Register = (on) => {
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined)
      await update($, pet, () => ({ status: 'working', headline: 'Thinking' }))
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (e.agentId === undefined) {
      const input = e as unknown as Record<string, unknown>
      const file = typeof input.file_path === 'string' ? input.file_path.split(/[\\/]/).pop() : ''
      const isAsking = e.tool === 'AskUserQuestion' || e.tool === 'ExitPlanMode'
      await update($, pet, () =>
        isAsking
          ? { status: 'waiting', headline: 'I have a question for you' }
          : {
              status: 'working',
              headline: `I am ${VERB[e.tool] ?? 'working'}${file ? `: ${file}` : ''}`,
            },
      )
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) return result
    const status: Status =
      e.reason === 'answer' ? 'done' : e.reason === 'aborted' ? 'idle' : 'error'
    await update($, pet, () => ({
      status,
      headline: status === 'error' ? 'I stopped on an error' : 'Done',
    }))
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const s = await read($, pet)
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="row" gap={1} minWidth={0}>
        <Text bold color={COLOR[s.status]}>{`● ${LABEL[s.status]}`}</Text>
        <Text wrap="truncate-end">{s.headline}</Text>
      </Box>
    )
  })
}
```

Three details carry the design. Each hook that only observes ends by calling `next(e)`, so Claude Code's own behavior continues. `turn.complete` awaits `next(e)` first and reacts to the settled turn. And the render hook reads the atom with `read`, which subscribes the drawing: every `update` redraws the band.

## Common mistakes and how to test it

These come from Narsil's code and fixes:

- **Reacting to subagents as if they were the main conversation.** Subagents raise `turn.start`, `tool.call` and `turn.complete` too, with `e.agentId` set. Narsil checks `e.agentId === undefined` before touching the main state.
- **Alarms that the permission mode already settled.** Detecting "needs you" from `tool.check` fires under bypass permissions. Narsil's fix (`2027f06`) listens to `classic.PermissionRequest` and still skips it when a settings hook answered (`result.decision`) or the mode is `bypassPermissions`.
- **A "done" that is not done.** A turn can end while background work goes on. Narsil reads `background_tasks` in `classic.Stop` before deciding (`519dd73`).
- **Text that widens the band.** On the desktop a long headline pushes the layout out. Use `minWidth={0}` on the column and `wrap="truncate-end"` on the text (`8e29583`).
- **Swallowing the stream.** A `turn.step` hook is a generator: if it does not `yield` every chunk from `next(e)`, the answer stops reaching the screen.
- **Ignoring surveys.** When `e.props.hasSurvey` is true, the band belongs to the survey; return `next(e)`.

To test, `claude plugin test .` runs the mod's `*.test.tsx` files. Narsil's `tests/narsil.test.tsx` is a good model: it starts a session with `$.session.start`, calls tools with `$.tool.call`, mounts the band with `$.ui.mount` and looks for texts with `find`. Tests worth copying by name include "a new conversation shows as stopped and ready, on every surface", "a permission dialog you must answer pops up as a question" and "an ask the mode settles by itself (bypass permissions) raises no alarm". Narsil's task log records that, in the author's shell, `claude plugin test .` needed `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1` (`odd/tasks/fleet-view.md`, L6). Run `claude plugin validate .claude-plugin/plugin.json` too: it checks your atom reads and writes against `types/index.d.ts`.

One note on surfaces: Narsil's README says the band works in the terminal, the desktop app, VS Code and the mobile app. The 2.1.325 types document `AbovePrompt` as "Raised on the terminal, desktop and mobile surfaces only". Test on the surfaces you care about rather than relying on either statement.

## Going further

The full version in narsil-pet adds a lot around the same core:

- `setMood` in `hooks/register.tsx` is the single entry point for every change, and it also pushes the state to the local hub (`pushOverlay`).
- `headline` and `LINES` in `hooks/words.ts` hold the sentence for each of the twelve moods and three comments for each; `describeCall` builds the detail for files, patterns, queries, URLs, commands and subagents.
- The `tool.call` hook also recognizes test commands (`TEST_COMMAND`) to celebrate passing tests, and warns about commands that cannot be undone (`dangerOf`), without blocking them.
- `startWaiting` and `stopWaiting` insist once on a permission or question left waiting five minutes.
- `announce` speaks and notifies at the key moments (start, done, question, error), and `sendStatus` sends the state to the phone.
- `FACE` in `hooks/sprite.ts` is the terminal face for each mood; `sprite` draws the full picture, covered in the next guide.
