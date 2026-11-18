---
title: The work map
description: 'How Narsil Check draws a live, animated map of what Claude is doing, with baby Narsil at its core, without ever making a tool wait or showing what you wrote.'
route: check
order: 2
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/map/hooks.ts
  - repo: check
    path: hooks/map/board.ts
  - repo: check
    path: hooks/map/classify.ts
  - repo: check
    path: hooks/map/draw.ts
  - repo: check
    path: hooks/map/stations.ts
  - repo: check
    path: hooks/map/words.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: tests/map-pane.test.tsx
  - repo: check
    path: odd/tasks/work-map.md
---

## What it does

The first section of the pane is **Mapa mental** ("Mind map"): a live picture of what Claude is doing in the session. Baby Narsil stands at the center, in her light or dark version as the app's theme is. Around her are ten stations, one per kind of work:

| Station       | English  | What lands there                                          |
| ------------- | -------- | --------------------------------------------------------- |
| **Tú**        | You      | Your messages, and each answer that is ready              |
| **Modelo**    | Model    | Each step of the model, and a change of model             |
| **Memoria**   | Memory   | Files in Claude Code's own memory folder                  |
| **Archivos**  | Files    | Read, Write, Edit, Grep, Glob and file commands           |
| **Terminal**  | Terminal | Shell commands, PowerShell and monitors                   |
| **Red**       | Network  | Web fetches and searches, and commands that reach the net |
| **Navegador** | Browser  | Browser tools                                             |
| **Agentes**   | Agents   | Subagents, workflows and background work                  |
| **Skills**    | Skills   | Skills, slash commands and tool searches                  |
| **Hooks**     | Hooks    | Settings hooks that refuse, ask or take a while           |

Each tool call leaves Narsil as a pulse toward its station. The station lights up while it works and shows how many times it was used. Around that, the map shows:

- **Spokes** that get thicker with use, and **a route** that joins the last stations visited and fades with time.
- **Two clock hands** around a station whose call is taking long.
- **A red dot** on a station after an error or a refusal from a hook, until your next message.
- **A ring** around Narsil that fills with the context in use: amber at 70% and red at 90%. Under her, the model and the percentage.
- **Subagents** that are still working, circling the **Agentes** station.
- **A background task** (a command, a monitor or an agent launched apart) that stays lit until it reports that it finished. If it has not reported in an hour, it is closed at the end of a turn.

The section's dot is blue while something works, red if something failed, and green at rest. On the terminal, which draws no SVG, the section is left out.

The map comes from [lot-map](https://github.com/alexeyw/lot-map), by Aleksei Volodin (MIT license), adapted to Narsil's colors. Narsil Check credits it in its README and keeps lot-map's copyright and permission notice in `hooks/map/LICENSE-lot-map.txt`.

## How it works inside

The map lives in `hooks/map/`, in four parts: `classify.ts` decides which station a call goes to, `board.ts` keeps what happened, `hooks.ts` listens to the events, and `draw.ts` turns the board into one SVG. `hooks/register.tsx` adds the section to the pane.

### Every call goes to one station, by name only

`classify(tool, input, setup)` reads the tool's name and its input and returns a station and a label. Most tools are a direct case: `Read`, `Write` and `Edit` go to **Archivos**, `WebFetch` to **Red**, `Agent` to **Agentes**, `Skill` to **Skills**. A file under `.claude/projects/<project>/memory/` goes to **Memoria** instead.

Shell commands need more work, because the tool is always `Bash` but the work is not. `classifyShell` reads the command's first word, sees through wrappers (`sudo`, `env`, `timeout`, `nohup` and the like run another command, and that one counts), and then decides: `cat`, `grep` or `mv` work on files, `curl`, `ssh` or `gh` reach the network, and some programs reach it only with some subcommands (`git push` does, `git status` does not; `npm install` does, `npm test` does not).

The label is what the map shows next to the station, and it carries names and nothing else:

- a file: its last two path parts (`src/app.ts`),
- a web page: its host alone, never the path, the query or a login (`hostOf` reads `user:pa/ss@host` as `host`),
- a command: its `description`, or else its name,
- a web search: the words `búsqueda web`, never the query.

`clean` also strips control characters and direction marks from every label, so a file name cannot move the cursor or reverse the text. One test is named for this rule: "labels never carry what was written, searched or a password".

### The board: one atom, and a copy for drawing

What the map shows is a `MapBoard` (in `types/index.d.ts`): a list of entries, a count per station, the model and step, the context percentage, the faults per station and the subagents still working. Each entry has a station, a label, a start and an end, and a status: `run`, `ok`, `err` or `block`.

The board is a session atom, `board`, written by four small functions in `board.ts`: `begin` opens an entry, `finish` closes it, `background` keeps it open under a task's id, and `settle` closes it when that task reports back. The board keeps the newest 80 entries, plus up to 16 older background tasks that are still running.

The pane does not read `board`. It reads `mapView`, a copy made at most every 400 ms:

```ts
async function redraw($: EngineInterface): Promise<void> {
  if (isRedrawPending) return
  isRedrawPending = true
  try {
    await $.clock.sleep(REDRAW_MS)
  } catch {
    // No clock: copy now.
  } finally {
    isRedrawPending = false
  }
  const current = await read($, board)
  await update($, shown, () => current)
}
```

Why? Each redraw sends the whole SVG to the app, Narsil's two pictures included. A burst of twenty calls would be twenty redraws. With the copy, the first write starts a 400 ms wait, the rest of the burst only changes `board`, and one copy at the end draws them all. The test "a burst of calls is one redraw of the map, made once the wait is over" checks it.

### The map never makes a tool wait

This is the rule the review insisted on. The map listens to `tool.call`, which wraps every tool. If it awaited its own writes before calling `next(e)`, every tool would wait on the map. So the entry is written beside the call, not before it:

```ts
export async function mapToolCall($, e, next) {
  const started = quietly(async () => {
    const seen = classify(e.tool, e, SETUP)
    return begin($, { ...seen, from: e.agentId === undefined ? 'core' : 'agents' })
  })
  const close = (how) => {
    void started.then(how).catch(() => undefined)
  }
  try {
    const ran = await next(e)
    // ...refused, failed, sent to the background, or ok
    close((id) => finish($, id, ran.isError === true ? 'err' : 'ok'))
    return ran
  } catch (failure) {
    close((id) => finish($, id, 'err'))
    throw failure
  }
}
```

`next(e)` starts at once. The entry is closed when both the call and the write are done, and the closing is not awaited either. `quietly` wraps every write: whatever goes wrong on the map returns `undefined` and never reaches the tool, the turn or the conversation. Every hook passes its event on unchanged, so the map never alters an input, a result or a permission decision.

The same goes for `classic.PreToolUse`: the decision of the settings hooks is returned as soon as it is made, and the map writes its entry afterwards. A check that took less than 400 ms is not drawn at all.

### Three events shared with the rest of the pane

The engine refuses a second `on()` of the same event without a matcher in one module. Narsil Check already listened to `turn.start`, `tool.call` and `turn.complete`. So the map exports those three as functions, `mapTurnStart`, `mapToolCall` and `mapTurnComplete`, and `register.tsx` calls each one in place of `next(e)`:

```tsx
on('tool.call', async ($, e, next) => {
  // ...what the pane already tracked
  return mapToolCall($, e, next)
})
```

Every other event the map needs (`turn.step`, `classic.PreToolUse`, `prompt.submit`, `skill.prompt`, `session.compact`, and the settings hooks that add context) registers in `registerMap(on)`, which `register` calls first.

### Faults, turns and background tasks

- A **new message** from you clears the faults: the red dots are about the way to the last answer.
- An **interrupted turn** lands on **Tú** and is no fault of anything. It also closes the calls that never reported back, so they do not pulse for the rest of the session.
- A call whose answer starts **background work** (`backgroundTaskId`, or an agent with `status: 'async_launched'`) stays open under that task's id. `taskNotice` reads the task's notification for its id and its status only, never its summary or output, and `settle` closes the entry.
- A **subagent** joins the `agents` list with its first call and leaves it when its own `turn.complete` arrives.

### Drawing: one SVG, baby Narsil at the core

`drawMap(board, now, narsil)` returns a string of SVG. Its animation is SMIL inside the SVG (`<animate>` with begin times relative to `now`), so the drawing moves between redraws with no help from the mod. It is drawn in the dark palette, and a `prefers-color-scheme: light` rule inside the SVG repaints each color, so the map follows the app's theme by itself, like Narsil's picture did.

The `Svg` element takes at most 131072 characters, and Narsil's two pictures take about 88 KB of that. `drawMap` checks the length: if the pictures would push the drawing past the limit, it draws the map again with `NARSIL` written at the core. The map always shows. The test "the map at its fullest, with baby Narsil, stays within what Svg accepts" draws the fullest board it can.

For readers who cannot see it, `describeMap` gives the `alt` text: the section, what is running now and the context, such as `Mapa mental. Archivos: src/app.ts · contexto 13%`.

In the pane, the section is drawn only when the surface has `Svg` and is not the terminal. It opens at every session start, and `resetMap()` forgets the refusals and the last model of the previous session.

## Build it with Claude

Ask Claude for a map of the session's work as a pane section. The two ideas it must get right are that the map never makes a tool wait, and that it shows names, never content.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> In my Claude Code mod `my-panel`, add a first section, `Map`, that draws what Claude is doing this session as one SVG: a core in the center and stations around it (you, model, memory, files, shell, network, browser, agents, skills, hooks). Classify each `tool.call` into a station with a label that carries names only: a file's last two path parts, a URL's host, a command's description. Keep the board in a session atom (entries with station, label, start, end and status `run`, `ok`, `err` or `block`, a count per station, faults per station) and let the pane read a copy made at most every 400 ms. The tool must never wait on the map: start `next(e)` at once, write the entry beside it, and wrap every write so a failure never reaches the tool. Animate with SMIL inside the SVG, follow the app's theme with a `prefers-color-scheme` rule, keep the SVG under 131072 characters, and leave the section out on the terminal. Test that a tool call does not wait for the board, that a burst of calls is one redraw, and that no label holds a query, a path beyond two parts or a password.

### What to check in Claude's answer

1. `next(e)` is called before the map's write is awaited, and no write of the map is awaited on the tool's path.
2. Every write of the map is wrapped so that an error is swallowed, and every hook returns its event's result unchanged.
3. Labels are names: two path parts, a host, a description. Search queries, page paths and command text do not appear.
4. The pane reads a throttled copy of the board, not the board itself.
5. The SVG's length is checked against the `Svg` limit, with a smaller fallback.
6. The section is left out where `Svg` is missing or the surface is the terminal.

If a check fails, tell Claude what you see: "with the map on, a slow file read made every tool call take longer" or "the map showed my whole search query next to Red".

### How the author asked for it

The task log, `odd/tasks/work-map.md` in narsil-check, quotes the requests word for word. They were in Spanish; translations follow each one.

The author first pointed Claude at lot-map:

> "mira este mod, quisiera traer la funcionalidad aca, como lo ves? https://github.com/alexeyw/lot-map"

("Look at this mod, I would like to bring its functionality here, how do you see it?") Claude proposed parts that Narsil already had, and the author narrowed it:

> "lo que propones traer ya lo tengo en narsilPet, me interesa traer es el mapa animado"

("What you propose to bring I already have in narsilPet; what I want to bring is the animated map.") Then the author accepted the plan and placed the section:

> "sí, avanza con ese plan, la seccion mapa va a ir de primeras, quita la imagen de narsil bebe y ponlo ahi, ya que es la misma imagen que ira creo que sera un buen reemplazo"

("Yes, go ahead with that plan. The map section goes first; remove baby Narsil's picture and put it there, since it is the same picture that will go there, I think it will be a good replacement.")

A review of the first version left five warnings: the pane redrew the whole SVG on every write, the tool waited on the map, a dead path for reduced motion, untested fault and task paths, and background entries that never expired. The author's answer was "Sí, corrígelos" ("Yes, fix them"). The commits on the feature's branch show the order:

- `bcae0da` "feat(map): classify Claude's work into the work map's stations".
- `e8b29dd` "feat(map): add the animated work map as the pane's first section".
- `4ee05ed` "fix(map): keep the work map off the tool's path and its redraws bounded".
- `1c6677c` "feat(map): larger, higher-contrast work map named Mapa mental".

The fix commit, `4ee05ed`, is the instructive one. The first version worked, and its tests passed. The review asked what the map costs the rest of the session, and the answer was a throttled copy and a tool that never waits.

After trying version 1.12.0, the author asked for a map that reads better:

> "las esferas deberian ser mas grandes al igual que el texto, o tener mas contraste ya que no se ve claramente lo que dice, narsil bebe tambien podria ser algo mas grande"

("The spheres should be bigger, and so should the text, or have more contrast, since what it says is not clearly visible; baby Narsil could be somewhat bigger too.") And then: "y al mapa ponle mapa mental" ("and call the map mind map"). That is `1c6677c`: bigger stations, names and counts, label colors with more contrast in each theme, a larger baby Narsil on a soft blue, and the section renamed **Mapa mental**.

## Reference code

This is one correct answer, written for this guide. Read it to understand how the pieces fit together and to compare it with what Claude wrote for you: Claude may choose other names or another order and still be right.

It is a reduced version of `hooks/map/board.ts` and `hooks/map/hooks.ts` in [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later), which adapt [lot-map](https://github.com/alexeyw/lot-map) (MIT, Copyright © 2026 Aleksei Volodin). It is checked against the Claude Code 2.1.325 types (`atom`, `read`, `update`, `$.clock.now`, `$.clock.sleep`, the `tool.call` hook). It keeps one station rule and leaves out drawing, faults and background tasks.

```ts
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

type Status = 'run' | 'ok' | 'err' | 'block'
type Entry = {
  id: string
  station: string
  label: string
  startedAt: number
  endedAt?: number
  status: Status
}
type Board = { entries: Entry[]; counts: Record<string, number> }

const EMPTY: Board = { entries: [], counts: {} }
const board = atom({ plugin: 'my-panel', key: 'board' } as const, EMPTY, { shape: 'board-1' })
const shown = atom({ plugin: 'my-panel', key: 'mapView' } as const, EMPTY, { shape: 'board-1' })

async function quietly<T>(work: () => Promise<T>): Promise<T | undefined> {
  try {
    return await work()
  } catch {
    return undefined
  }
}

let isRedrawPending = false
async function redraw($: EngineInterface): Promise<void> {
  if (isRedrawPending) return
  isRedrawPending = true
  try {
    await $.clock.sleep(400)
  } catch {
    // No clock: copy now.
  } finally {
    isRedrawPending = false
  }
  const current = await read($, board)
  await update($, shown, () => current)
}

async function write($: EngineInterface, by: (b: Board) => Board): Promise<void> {
  await update($, board, by)
  void redraw($).catch(() => undefined)
}

const lastTwo = (path: string): string =>
  path.replace(/\\/g, '/').split('/').filter(Boolean).slice(-2).join('/')

function classify(
  tool: string,
  input: Record<string, unknown>,
): { station: string; label: string } {
  const path = typeof input.file_path === 'string' ? input.file_path : ''
  if (tool === 'Read' || tool === 'Write' || tool === 'Edit')
    return { station: 'files', label: lastTwo(path) || tool }
  if (tool === 'WebSearch') return { station: 'web', label: 'web search' }
  return { station: 'model', label: tool }
}

export const register: Register = (on) => {
  on('tool.call', async ($, e, next) => {
    const started = quietly(async () => {
      const now = await $.clock.now()
      const entry: Entry = {
        id: `${now}-${Math.random()}`,
        ...classify(e.tool, e as Record<string, unknown>),
        startedAt: now,
        status: 'run',
      }
      await write($, (b) => ({
        entries: [...b.entries, entry].slice(-80),
        counts: { ...b.counts, [entry.station]: (b.counts[entry.station] ?? 0) + 1 },
      }))
      return entry.id
    })
    const close = (status: Status): void => {
      void started
        .then((id) =>
          quietly(async () => {
            const now = await $.clock.now()
            await write($, (b) => ({
              ...b,
              entries: b.entries.map((x) => (x.id === id ? { ...x, status, endedAt: now } : x)),
            }))
          }),
        )
        .catch(() => undefined)
    }
    try {
      const ran = await next(e)
      close(ran.deny !== undefined ? 'block' : ran.isError === true ? 'err' : 'ok')
      return ran
    } catch (failure) {
      close('err')
      throw failure
    }
  })
}
```

The pane reads `shown` with `read($, shown)` and draws it with `Svg` only when the surface has one and is not the terminal.

## Common mistakes and how to test it

These come from Narsil Check's code, its review and its tests:

- **Awaiting the map before the tool.** Every call gets slower. Start `next(e)` first and write beside it.
- **Letting a map error escape.** A failed write would fail the tool. Wrap every write.
- **Redrawing on every write.** A burst of calls becomes a burst of large SVGs. Throttle a copy.
- **Showing content.** A search query, a URL path or a command line can hold secrets. Keep names only, and clean control characters.
- **Calls that never close.** An interrupted turn or a lost notification leaves an entry pulsing forever. Close them at the end of the turn, and expire old background tasks.
- **Registering an event twice in one module.** The engine refuses it. Call the map's function from the existing hook instead.
- **Forgetting the `Svg` limit.** Embedded pictures are large. Measure, and fall back.

To test, `claude plugin test .` runs the mod's tests. `tests/map.test.tsx` covers the pure parts: "every kind of call lands on its station", "a command behind a wrapper or inside another is the command it runs" and "labels never carry what was written, searched or a password". `tests/map-pane.test.tsx` drives the hooks: "a tool never waits on the map", "a burst of calls is one redraw of the map, made once the wait is over", "a refused call turns the map red with a dot on its station, and the next message clears it" and "a background task that never reports back is closed at the end of a turn once it is an hour old". In `tests/pane.test.tsx`, "the work map is the first section, open, with baby Narsil at its core; the terminal draws neither" checks the place of the section.

## Going further

- Let the person name their own memory servers or commands: `hooks/map/stations.ts` keeps lot-map's setup, with every list empty.
- Port lot-map's feed of rows, a text list of the last actions, for the terminal, where the SVG is not drawn.
- Add a zoom or a station filter, which lot-map has and this port left out.
