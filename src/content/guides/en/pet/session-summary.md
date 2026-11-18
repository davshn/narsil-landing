---
title: Session summary
description: 'How Narsil counts what a conversation has done (turns, files, commands, failures, subagents) and keeps counting when Claude Code restarts, for /narsil resumen and a summary after a pause.'
route: pet
order: 16
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/watch.ts
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: types/index.d.ts
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## What it does

`/narsil resumen` ("summary") answers a question that is hard to answer from the transcript: what has this conversation actually done so far? It prints one line:

```text
📋 Sesión de 1 h 5 min: 4 turnos (12 min de trabajo) · 3 archivos editados (a.ts, b.ts, c.ts) · 7 comandos, 1 fallo · 2 subagentes · contexto 40 %
```

In English: a 1 h 5 min session, 4 turns (12 minutes of work), 3 files edited, 7 commands with 1 failure, 2 subagents, the context 40 % full. The example is the one in the comment above `summaryText` in `hooks/watch.ts`.

Narsil also shows it on her own once a conversation has been quiet for 30 minutes after a turn: a natural moment to look back, for instance after a break. It shows where her tips show (guide 11): in a small window of its own on Windows and macOS, in the band elsewhere.

If you close Claude Code and later take the conversation up again, the summary goes on adding from where it was. Narsil keeps the counts of the 20 most recent conversations.

## How it works inside

### What is counted: the `Stats` type

The counts are one value, the `stats` atom in `hooks/register.tsx`, of the type `Stats` declared in `types/index.d.ts`:

| Field       | What it counts                           | Where it is added                     |
| ----------- | ---------------------------------------- | ------------------------------------- |
| `startedAt` | when the conversation's counts began     | the first time, at `session.start`    |
| `turns`     | finished turns of the main conversation  | `turn.complete`, any reason           |
| `workedMs`  | the time those turns took                | `turn.complete`, from `e.durationMs`  |
| `files`     | the names of the files edited, up to 200 | `tool.call` of a writing tool         |
| `moreFiles` | files past the first 200, counted only   | the same                              |
| `commands`  | shell commands run                       | `tool.call` of `Bash` or `PowerShell` |
| `failures`  | tool calls that returned an error        | after `next(e)` in `tool.call`        |
| `agents`    | subagents started                        | `agent.spawn`                         |

Every change goes through one function, `bumpStats($, change)`, which applies a pure change to the atom (starting from `emptyStats(now)` if there is none yet) and saves it. The helpers in `hooks/watch.ts` keep the rules plain: `emptyStats`, `addFile`, `summaryText`, `statsOf`.

A few details decide what the numbers mean:

- **The writing tools** are `Edit`, `MultiEdit`, `Write` and `NotebookEdit` (`WRITING_TOOLS` in `hooks/words.ts`). The file is the short detail the band shows, the file's base name, and `addFile` adds a name only once. So the summary counts distinct names: two `index.ts` files in different folders count as one.
- **Subagents' work counts too.** The `tool.call` hook adds files, commands and failures whatever `e.agentId` says, while `turns` counts only the main conversation's turns, since a subagent's `turn.complete` returns before that line.
- **Only Claude's calls count.** The hook starts with `isClaudesCall(next.origin)`: a call another mod makes is not part of the session's work (guide 1).
- **A failed test is a failure.** `failures` counts any tool result with `isError`, a failing test run included.
- **The context** is not stored: `summarize` reads the current percent from the `usage` atom of guide 7, and leaves it out when there is none.

`summaryText(stats, now, contextPercent)` writes the line. It names at most three files and adds "…" after them when there are more, writes "ningún archivo editado" ("no file edited") when there are none, leaves the subagents out when there were none, and handles the plural of every count. The length is `now - startedAt`, written in minutes or in hours and minutes.

### Why two layers of persistence

Narsil keeps the counts in two places, and each covers a different kind of restart:

- **`$.state`, the atom.** The types describe it as "plain data that survives a hot reload of the plugin's code". A reload of the mod, which follows any turn that edits it, keeps the counts without doing anything.
- **`$.store`, one key per conversation.** The store is "kept between sessions and hot reloads". `loadStats` asks `$.session.id()`, which the types describe as "the session's id (the transcript file's name)", and uses the key `stats:<id>`. `saveStats` writes the whole value there after every change.

At `session.start`, `loadStats` fills the atom from the store only when the atom is empty. A reload keeps the atom and skips the store; a restart of Claude Code with the same conversation has an empty atom and reads it back. The comment at that point sums it up: "The stats survive a reload of the mod, and Claude Code restarting with this conversation: only a new conversation starts them."

The key is per conversation on purpose. The XP of guide 13 is one number for the machine, added to by everyone; a summary is about one conversation, so each has its own.

If `$.session.id()` fails, the key is empty and nothing is stored: the counts then last only as long as the atom.

One consequence follows from keeping `startedAt`: the length counts from when the conversation's counts began, so time with Claude Code closed is included. A conversation taken up the next morning says it has lasted all night.

### Keeping only 20

A key per conversation grows without end, so `saveStats` cleans up once per load of the module (`isStatsPruned`). It lists the store's keys, keeps the ones that start with `stats:` other than its own, and deletes the oldest until 19 are left, so 20 remain with its own. The code relies on the order: "Oldest first: the store lists its keys in the order they were set." The types say `$.store.keys()` "Returns every key set, in insertion order." Any failure to list or delete leaves every key in place.

`statsOf` validates what it reads: every count must be a finite number and `files` an array of strings, or the stored value is ignored and the conversation starts over. The comment calls it "A stored value from any version, or none".

### The summary after a pause

The heartbeat (`beat`, every 2 seconds) calls `tickWatch`, which shows the summary when all of this holds:

- a turn has finished: the cache clock of guide 8 has a start, `c.at`, which the end of each turn sets;
- nothing is still running in the background (`backgroundAtStop === 0`);
- 30 minutes (`IDLE_SUMMARY_MS`) have passed since `c.at`;
- this turn's pause has not been summed up yet (`summarizedFor !== c.at`);
- the conversation has at least one turn;
- quiet mode is off (guide 14).

Then it calls `showTip($, await summarize($), 'summary')`. Reusing the tip's display means the summary gets the tip window, the band's three lines and the floating window for free. `summarizedFor` makes it once per pause: a new turn sets a new `c.at`, and the next pause can be summed up again.

## Build it with Claude

Ask Claude for a command that sums the conversation up from counts the mod keeps as the session goes. The one idea it must get right is where the counts live: in an atom, so a reload of the mod keeps them, and in `$.store` under one key per conversation, so a restart of Claude Code keeps them too.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> In my Claude Code mod `my-pet`, add `/my-pet summary`. Keep a `stats` atom with `startedAt`, `turns`, `workedMs`, `files` (distinct base names, at most 200), `commands`, `failures` and `agents`. Count turns and their `durationMs` in `turn.complete` of the main conversation; edited files from `Edit` and `Write` calls in `tool.call`; `Bash` calls as commands; any result with `isError` as a failure; subagents in `agent.spawn`. Change the atom only through one function that also saves it to `$.store` under `stats:` plus `$.session.id()`. At `session.start`, load it from the store only if the atom is empty, and validate what you read. Keep only the last 20 such keys. The command prints one line like "Session of 12 min: 3 turns · 2 files edited (a.ts, b.ts) · 4 commands, 1 failure". Test with `claude-code/testing`: a stored value under the session's key is continued, and a 25th old key is deleted.

### What to check in Claude's answer

1. Every count is in one atom, never in a module variable, and changes only through one function that also saves it.
2. The store key is `stats:` followed by `$.session.id()`, so each conversation has its own counts.
3. At `session.start` the store is read only when the atom is empty, and what is read is checked field by field before it is used.
4. Turns are counted only for the main conversation in `turn.complete`, and an edited file is counted once per base name.
5. Only the 20 most recent `stats:` keys are kept.

If a check fails, tell Claude what you see: "after I restart Claude Code and take this conversation up again, the summary says 0 turns".

### How the author asked for it

The original request for the session summary was not recorded.

One recorded request touches the module the summary was born in. `hooks/watch.ts` began with a loop alert, a reminder for waiting permissions and the summary. In `odd/tasks/fleet-view.md`, L1 (2026-11-06), the author asked:

> "eliminariamos la alerta de bucle, no la he sentido tan util"

In English: we would remove the loop alert, I have not found it that useful. The task log records it as S9, and `21e7288` removed it. The summary and the reminder stayed.

#### Reconstruction from the commit history

From `git log -- hooks/watch.ts` in narsil-pet:

- `f7a494e` (2026-10-30) "feat: warn about loops, insist on waiting permissions and sum the session up". The summary, the reminder and the loop alert arrive together.
- `21ffc2e` (2026-10-31) "fix: keep a conversation's session summary when Claude Code restarts". The `stats:<id>` keys, `statsOf` and the limit of 20 (`KEEP_STATS`) come from here. The first version lived only in the session.
- `36256f9` (2026-10-31) "feat: let the band, window and alerts speak in Narsil's first person".
- `2bcc97c` (2026-11-05) "feat: open the context breakdown from the usage bars and calm loop, steps and permission alerts".
- `519dd73` (2026-11-06) "fix: wait for background work before announcing a turn finished". The `backgroundAtStop === 0` condition of the pause summary arrives with it.
- `21df208` (2026-11-06) "fix: ignore tool calls other mods make, so Narsil no longer sticks at working". Its message names another mod's calls being counted as Claude's work; `isClaudesCall` keeps them out of the counts too.
- `21e7288` (2026-11-06) "refactor: drop the loop alert, the spending count and the open-conversations line".

The first correction is the instructive one: a summary that is lost when Claude Code restarts reports a fraction of the work, which is worse than none.

## Reference code

This is one correct answer, written for this guide. Read it to understand how the pieces fit together and to compare it with what Claude wrote for you: Claude may choose other names or another order and still be right.

Written for this guide and checked against the 2.1.325 types (`$.session.id`, `$.store.get`, `$.store.set`, `$.clock.now`, `$.command.register`, `command.run`, `session.start`, `tool.call`, `turn.complete`, `agent.spawn`). It is adapted from `hooks/watch.ts` and `hooks/register.tsx` in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). The `stats` atom is declared in `types/index.d.ts` as `Stats | null`, with the type below. Pruning to 20 is left out; see `saveStats`.

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'
import type { Stats } from '../types'
// type Stats = { startedAt: number; turns: number; workedMs: number;
//   files: string[]; commands: number; failures: number; agents: number }

const stats = atom({ plugin: 'my-pet', key: 'stats' } as const, null)
let key = ''

const empty = (startedAt: number): Stats => ({
  startedAt,
  turns: 0,
  workedMs: 0,
  files: [],
  commands: 0,
  failures: 0,
  agents: 0,
})
const baseName = (path: string) => path.split(/[\\/]/).pop() ?? path

async function bump($: EngineInterface, change: (s: Stats) => Stats): Promise<void> {
  const now = await $.clock.now()
  const next = await update($, stats, (s) => change(s ?? empty(now)))
  if (key) await $.store.set(key, next).catch(() => undefined)
}

function summary(s: Stats, now: number): string {
  const minutes = Math.round((now - s.startedAt) / 60_000)
  const files = s.files.length
    ? ` (${s.files.slice(0, 3).join(', ')}${s.files.length > 3 ? '…' : ''})`
    : ''
  return `Session of ${minutes} min: ${s.turns} turns · ${s.files.length} files edited${files} · ${s.commands} commands, ${s.failures} failures · ${s.agents} subagents`
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'my-pet', description: 'My pet: summary' })
    key = `stats:${await $.session.id().catch(() => '')}`
    if (key === 'stats:') key = ''
    // A reload keeps the atom; a restart reads the store back.
    if (key && !(await read($, stats))) {
      const kept = await $.store.get(key).catch(() => undefined)
      if (kept && typeof kept === 'object' && typeof (kept as Stats).turns === 'number')
        await update($, stats, (s) => s ?? (kept as Stats))
    }
    if (!(await read($, stats))) await bump($, (s) => s)
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const path = (e as { file_path?: unknown }).file_path
    if ((e.tool === 'Edit' || e.tool === 'Write') && typeof path === 'string') {
      const name = baseName(path)
      await bump($, (s) =>
        s.files.includes(name) || s.files.length >= 200 ? s : { ...s, files: [...s.files, name] },
      )
    }
    if (e.tool === 'Bash') await bump($, (s) => ({ ...s, commands: s.commands + 1 }))
    const result = await next(e)
    if (result.isError) await bump($, (s) => ({ ...s, failures: s.failures + 1 }))
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined)
      await bump($, (s) => ({ ...s, turns: s.turns + 1, workedMs: s.workedMs + e.durationMs }))
    return result
  })

  on('agent.spawn', async ($, e, next) => {
    const result = await next(e)
    await bump($, (s) => ({ ...s, agents: s.agents + 1 }))
    return result
  })

  on('command.run', { command: 'my-pet' }, async ($, e) => {
    if (e.args.trim() !== 'summary') return { text: 'Usage: /my-pet summary' }
    const now = await $.clock.now()
    return { text: summary((await read($, stats)) ?? empty(now), now) }
  })
}
```

`update` resolves to the value it wrote, so `bump` saves exactly what the atom holds. The check of the stored value here is a sketch; Narsil's `statsOf` checks every field.

## Common mistakes and how to test it

- **Counting in module variables.** A reload of the mod follows any turn that edits it, and a module variable starts over. Keep counts in an atom.
- **One store key for all conversations.** Then every conversation's summary is everyone's. Key by `$.session.id()`.
- **Loading the store over a live atom.** After a reload the atom is the newer value; the store may lag by one change. Load only when the atom is empty.
- **A store that grows forever.** One key per conversation needs a limit and a cleanup.
- **Trusting what is stored.** An older version may have stored another shape. Validate field by field, and start over when it does not fit.
- **Summing up at the wrong moment.** A pause while background work runs is not a pause. Narsil waits for it to end, and sums up each pause only once.

To test, `tests/narsil.test.tsx` has four tests. "/narsil resumen sums the session up, and so does a 30-minute pause after a turn" checks the exact line ("Narsil: 📋 Sesión de 0 min: 2 turnos (1 min 24 s de trabajo) · 2 archivos editados (a.ts, b.ts) · 1 comando, 0 fallos.") and then advances the fake clock. "a conversation taken up again keeps counting its session, kept across restarts" answers `session.id` with a fixed id, puts earlier counts in the store under `stats:` and that id, and checks the next turn adds to them. "only the last 20 conversations keep their counts, and an odd stored value is ignored" starts with 25 old keys and an invalid value. "the summary names three files at most, and counts subagents and context" tests `summaryText` alone.

## Going further

- `nudgeText` and `NUDGE_AFTER_MS` in `hooks/watch.ts`, the summary's neighbours, drive the five-minute reminder of guide 10.
- `took` in `hooks/agents.ts` writes the durations ("1 min 24 s") for the summary and for the subagents.
- The next and last guide of the path shows how `/narsil` itself is registered and how its words, `resumen` among them, are dispatched.
