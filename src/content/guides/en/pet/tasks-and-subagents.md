---
title: Tasks and subagents
description: "How Narsil rebuilds a conversation's task list from TodoWrite, TaskCreate, TaskUpdate and the desktop app's plan, and shows each subagent as a chip with its type, model and time."
route: pet
order: 4
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/tasks.ts
  - repo: pet
    path: hooks/agents.ts
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

When you open a conversation in Narsil's band (by pressing its name, as the previous guide explains), two lists appear under a line.

**Its tasks**, each with a mark for its state:

| Mark | State                                          |
| ---- | ---------------------------------------------- |
| ○    | Pending                                        |
| ◐    | In progress                                    |
| ●    | Done (drawn dimmed)                            |
| ⟳    | Running in the background after Claude stopped |

The list is the one Claude keeps for itself while it works: the todo list of `TodoWrite`, the tasks of `TaskCreate` and `TaskUpdate`, or the plan of the desktop app. You see the plan and how far along it is without scrolling the transcript.

**Its subagents**, one small serpent each, with:

- **Its type**, shown as an accessory: 🐍🔍 Explore, 🐍📜 Plan, 🐍📖 claude-code-guide, 🐍🪞 fork, a bare 🐍 for general-purpose and 🐍✨ for any other type.
- **The model it runs on and how long it has run**, for example "🐍🔍 Explorar el overlay · Haiku 4.5 · 4 min" ("Explore the overlay").
- **A warning when it goes quiet**: after five minutes without using any tool, the chip turns yellow and adds "sin actividad" ("no activity"). It may be stuck.
- **How it ended**, for a few seconds: "✓ … · terminado en 1 min 20 s" (finished in), "✗ … · falló" (failed) or "■ … · detenido" (stopped).

A subagent that ran in the background is also announced, with Narsil's voice and in the floating window, when it ends.

Because every conversation reports its tasks and subagents to the hub, you can open another conversation's row and see its plan and its subagents from where you are.

## How it works inside

### Tasks: replaying the tools' calls

Claude Code does not hand a mod "the task list". Narsil rebuilds it by watching the calls of the tools that keep one, and applying each call to the list it already has. The logic is a pure function, `applyTaskCall` in `hooks/tasks.ts`; the hook in `hooks/register.tsx` only feeds it.

The tools it reads (`TASK_TOOLS`) and what each call does to the list:

- **`TodoWrite`** sends the whole list every time (`todos`, each with `content` and `status`). The list is replaced; ids are the positions, `1`, `2`, `3`.
- **`TaskCreate`** adds one task. Its id is not in the input: it comes back in the tool's result (`result.task.id`). So the hook reads the result, and falls back to the next position when there is none.
- **`TaskUpdate`** changes one task by `taskId`: a new `status`, a new `subject`, or `status: 'deleted'`, which removes it.
- **`mcp__ccd_turn__update_plan`**, the desktop app's plan (`PLAN_TOOL`). `applyPlan` handles its shapes: `items` replaces the list; `advance: true` completes the step in progress and starts the next pending one; `done: [n]` completes steps by their 1-based place; `start: n` moves the in-progress mark to step `n`.
- **`mcp__ccd_turn__wrap_up`**, the desktop app's next-step box (`WRAP_UP_TOOL`). It closes the turn and, in the app, checks the plan off with no last `update_plan`. Narsil therefore marks every pending or in-progress task as completed on it. This is the fix described in "How it was asked of the AI".

The hook in `tool.call` handles these tools only for the main conversation (`e.agentId === undefined`) and in a particular order: it awaits `next(e)` first, and applies the call only when the result is not an error and was not denied. A refused `TaskUpdate` must not move the list, and `TaskCreate`'s id exists only after the tool ran. Then it writes the `tasks` atom and pushes the state to the hub at once.

Text is cleaned on the way in: whitespace collapsed and cut to 120 characters (`clean`), and the list capped at 30 tasks (`MAX_TASKS`), since it travels to the hub and the phone on every heartbeat.

### Background work as tasks

When the main loop stops, the `classic.Stop` hook reads `e.background_tasks`: shells, monitors and subagents still running. `backgroundTasks` turns them into extra rows with the ⟳ mark, such as "proceso en segundo plano: npm run dev" ("process in the background"). They are kept apart from the task list and joined to it when the state is reported (`shownState`), and they are cleared at the next `turn.start`. The same count tells `turn.complete` not to celebrate a finish while work goes on (see the first guide).

### Subagents: three events

The chips come from three events, and the choice of each one is deliberate:

- **`agent.spawn`** starts a chip. The hook awaits `next(e)` and records the run from both the input and the result: `result.agentId`, `e.description` (the task), `e.subagentType`, `e.background`, and `result.model`. It skips denied spawns and teammates (`e.isTeammate`). The comment in `hooks/register.tsx` explains why this event and not the `Agent` tool call: "one in the background returns at once", so the tool call's end says nothing about when the subagent ends.
- **`tool.call` with `e.agentId` set**: the subagent used a tool. `touchAgent` updates its `lastActiveAt`. This is what makes "no activity" possible: Narsil knows the last time each subagent did something.
- **`turn.complete` with `e.agentId` set**: the subagent's own turn ended. `endAgent` stores `endedAt` and an outcome from `e.reason`: `answer` is done, `aborted` is stopped, anything else is failed. A background one is announced.

The runs live in the `agents` atom, the chips (text and color, ready to draw) in `agentChips`.

### Chips are recomputed on every heartbeat

Time passes without any event: a subagent that does nothing raises nothing. So `refreshAgents` runs on every two-second heartbeat (`beat`) as well as after each of the three events. It drops ended runs older than ten seconds (`liveRuns`, `ENDED_SHOWN_MS`), recomputes every chip with `agentChip`, and writes the atom and pushes to the hub only when a chip's text or color changed.

`agentChip` in `hooks/agents.ts` builds the text:

- The type's mark from `TYPE_MARK`, with ✨ for unknown types.
- The task, then the model through `modelLabel`, which reads ids and aliases as a person would: `claude-opus-5-5` becomes "Opus 5.5", `claude-3-5-sonnet-20241022` becomes "Sonnet 3.5", and `opus[1m]` becomes "Opus (1M)".
- The minutes, from one minute on.
- "sin actividad" once `now - lastActiveAt` reaches `QUIET_MS` (five minutes), with the yellow tone.
- For an ended run, ✓ with the time from `took`, ✗ or ■.

The colors are in `TONE_COLOR`: grey for running, yellow `#F5B400` for quiet, green for done, red for failed and grey-blue for stopped.

### Why it is split this way

The two files, `hooks/tasks.ts` and `hooks/agents.ts`, are pure: plain values in, plain values out, no `$`. The hooks module owns the events and the atoms. That split is what lets the tests check every tool shape and every chip text without a session, and lets the same list be drawn by the band, the floating window and another conversation's band.

## How it was asked of the AI

### Tasks: recorded in the fleet-view log

The task list per conversation was asked for in `odd/tasks/fleet-view.md` in narsil-pet. In L2 (excerpt), the author wrote:

> "al hacer click en el titulo de conversacion deberiamos poder ver sus sub agentes/ tareas y sus respectivos estados"

In English: clicking a conversation's title should show its subagents and tasks with their states.

And in L3 (excerpt):

> "cuando entre a una de esas conversaciones estaria de nuevo su contexto, sus tareas con su estado (no es necesario barra de avance) y sus sub agentes"

In English: when entering one of those conversations there would again be its context, its tasks with their state (no progress bar needed) and its subagents. That is why tasks are shown as marks and not as a percentage.

L7 records the result: the open conversation shows its tasks and its subagents, and "Tasks come from TodoWrite, TaskCreate/TaskUpdate, the desktop app's update_plan (hooks/tasks.ts) and background work at Stop."

Then the author reported a bug, L12:

> "lo unico raro que veo es que las tareas de esta sesion las marca como en curso, o no empezadas, cuando el agente ya acabo, esto pasa en las dos ventanas, ademas note que creaste las tareas de la pwa en este proyecto, debias crearlo en proyecto de la pwa"

In English: the only odd thing is that this session's tasks show as in progress or not started when the agent has already finished, in both windows; the author also noticed that the follow-up tasks for the PWA were created in this project instead of the PWA's project. (The second part is about where follow-up notes were stored, not about this feature.)

L13 records the cause and the fix: "the desktop app's `mcp__ccd_turn__wrap_up` checks the plan off with no last `update_plan`; the mod now marks every pending or in-progress task completed on it (hooks/tasks.ts)", with a failing test observed first. The commit is `5e9ca71` (2026-11-06) "fix: check the plan off when the app's next-step box closes the turn".

### Subagents: reconstruction from the commit history

The original request for the subagent chips was not recorded. From `git log -- hooks/agents.ts hooks/register.tsx`:

- `c885292` (2026-10-30) "feat: estimate when the context fills, react to tests and dangerous commands, show subagents". The first chips.
- `e5ba5ca` (2026-10-30) "feat: show each subagent's type, time, quiet spells and outcome". The marks per type, the minutes, the quiet warning and the ending.
- `f29cb5e` (2026-10-31) "feat: show the model of the main thread and of each subagent". The model label.
- `519dd73` (2026-11-06) "fix: wait for background work before announcing a turn finished". Background subagents become ⟳ rows.
- `49f0fd9` (2026-11-06) "feat: list every open conversation in the band". Its message says that opening a row shows "its context (the word opens what fills it), its tasks and its subagents".

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> In my Claude Code mod, show the main conversation's task list in the `AbovePrompt` band. In `tool.call`, for `TodoWrite`, `TaskCreate` and `TaskUpdate` calls with no `agentId`, await `next(e)` and, when the result is not an error, apply the call to a list kept in an atom: `TodoWrite` replaces it, `TaskCreate` adds the task with the id from its result, `TaskUpdate` changes or deletes one by `taskId`. Keep that logic as a pure function in `hooks/tasks.ts` with tests for each tool. Also show one line per running subagent: start it on `agent.spawn` (task, `subagentType`, `result.model`), mark it active on its `tool.call`s, end it on its `turn.complete`, and every few seconds recompute the text so a subagent idle for five minutes says so. Check every field against the plugin-authoring types.

## The minimal code

Written for this guide and checked against the 2.1.325 types. It is adapted from `hooks/tasks.ts`, `hooks/agents.ts` and `hooks/register.tsx` in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). The `tasks` and `runs` atoms are declared in `types/index.d.ts` as in the first guide.

The pure reducer, `hooks/tasks.ts`:

```ts
export type Task = { id: string; text: string; status: 'pending' | 'in_progress' | 'completed' }

const STATUSES = ['pending', 'in_progress', 'completed']
const statusOf = (v: unknown, fallback: Task['status'] = 'pending') =>
  STATUSES.includes(v as string) ? (v as Task['status']) : fallback

export function applyTaskCall(
  list: readonly Task[],
  tool: string,
  input: Record<string, unknown>,
  result?: unknown,
): readonly Task[] {
  if (tool === 'TodoWrite' && Array.isArray(input.todos)) {
    return (input.todos as Record<string, unknown>[]).map((t, i) => ({
      id: String(i + 1),
      text: String(t.content ?? ''),
      status: statusOf(t.status),
    }))
  }
  if (tool === 'TaskCreate') {
    const task = (result as { task?: { id?: unknown; subject?: unknown } } | undefined)?.task
    const id = task?.id === undefined ? String(list.length + 1) : String(task.id)
    return [
      ...list.filter((t) => t.id !== id),
      { id, text: String(task?.subject ?? input.subject ?? ''), status: 'pending' },
    ]
  }
  if (tool === 'TaskUpdate') {
    const id = String(input.taskId ?? '')
    if (input.status === 'deleted') return list.filter((t) => t.id !== id)
    return list.map((t) => (t.id === id ? { ...t, status: statusOf(input.status, t.status) } : t))
  }
  return list
}
```

The hooks, in `hooks/register.tsx`:

```tsx
const TASK_TOOLS = new Set(['TodoWrite', 'TaskCreate', 'TaskUpdate'])
const QUIET_MS = 5 * 60_000

on('tool.call', async ($, e, next) => {
  if (e.agentId !== undefined) {
    const now = await $.clock.now()
    await update($, runs, (list) =>
      list.map((r) => (r.id === e.agentId ? { ...r, lastActiveAt: now } : r)),
    )
    return next(e)
  }
  if (!TASK_TOOLS.has(e.tool)) return next(e)
  const result = await next(e)
  if (!result.isError && !('deny' in result && result.deny)) {
    const input = e as unknown as Record<string, unknown>
    await update($, tasks, (list) =>
      applyTaskCall(list, e.tool, input, 'result' in result ? result.result : undefined),
    )
  }
  return result
})

on('agent.spawn', async ($, e, next) => {
  const result = await next(e)
  if ('deny' in result || e.isTeammate || !result.agentId) return result
  const now = await $.clock.now()
  const run = {
    id: result.agentId,
    task: e.description || 'task',
    type: e.subagentType,
    model: result.model,
    startedAt: now,
    lastActiveAt: now,
  }
  await update($, runs, (list) => [...list.filter((r) => r.id !== run.id), run])
  return result
})

on('turn.complete', async ($, e, next) => {
  const result = await next(e)
  if (e.agentId !== undefined)
    await update($, runs, (list) => list.filter((r) => r.id !== e.agentId))
  return result
})
```

In the render hook, a run is quiet when `(await $.clock.now()) - run.lastActiveAt >= QUIET_MS`. Narsil also keeps ended runs for ten seconds to show how they ended, and recomputes the chips on a `$.clock.every` heartbeat so "no activity" appears even when no event arrives. A minimal version can do the same with `$.clock.every(5000, ...)` updating an atom the band reads.

## Common mistakes and how to test it

- **Applying the call before it ran.** `TaskCreate`'s id is only in the result, and a denied or failed call must not change the list. Await `next(e)`, then apply.
- **Tracking subagents' own task tools as the main list.** A subagent may call `TodoWrite` too. Narsil applies task calls only when `e.agentId` is undefined.
- **Plans that never finish.** In the desktop app, the next-step box (`mcp__ccd_turn__wrap_up`) closes the turn and checks the plan off without a last `update_plan`. Without handling it, the last steps stay "in progress" forever (fleet-view L12 and L13, commit `5e9ca71`).
- **Timing subagents by the `Agent` tool call.** A background subagent's tool call returns at once. Use `agent.spawn` and the subagent's own `turn.complete`.
- **A quiet warning that never appears.** Nothing raises an event while a subagent is idle. Recompute on a clock.
- **Rewriting state on every tick.** Compare before writing; Narsil's `refreshAgents` writes and pushes only when a chip changed.
- **Unbounded text.** Task subjects and descriptions can be long. Clean and cap them before they travel.

To test, `claude plugin test .` runs `tests/narsil.test.tsx`. "the task tools leave this conversation its list, for the band and the hub" calls `TodoWrite`, `TaskCreate` and `TaskUpdate`, then the desktop plan with `items` and `advance`, then `mcp__ccd_turn__wrap_up`, and checks the band's lines (" ● Leer", " ◐ Escribir el test") and the list sent to the hub. For subagents, "each subagent shows its type, how long it has run, and when it has gone quiet" advances a mocked clock (`mock.clock`) and checks the chips, including the yellow `#F5B400`; "a finished subagent stays a few seconds with how it ended, then leaves", "each subagent shows the model it runs on" and "the subagent chips show each type with its own mark" cover the rest.

## Going further

- `applyPlan` in `hooks/tasks.ts` handles every shape of the desktop app's plan; `TASK_ICON` holds the marks.
- `backgroundTasks` names background work by kind: process, monitor, subagent.
- `refreshAgents`, `touchAgent` and `endAgent` in `hooks/register.tsx` manage the runs; `endAgent` also gives experience for a subagent that finished well (`gainXp($, 'agent')`) and announces background ones.
- `modelLabel` and `took` in `hooks/agents.ts` are the formatting helpers, and `MAX_AGENTS_SHOWN` in `hooks/words.ts` caps the band at six chips.
- The open conversation's block in the `AbovePrompt` render hook draws "Tareas:" and each task with `TASK_COLOR`, then the chips, for whichever conversation is open, using the tasks and chips that conversation reported to the hub.
