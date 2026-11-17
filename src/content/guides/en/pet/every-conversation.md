---
title: Every conversation in one place
description: 'How Narsil gathers the state of every open conversation in a local hub, ranks them error first, pages them four at a time and forgets the silent ones after an hour.'
route: pet
order: 3
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/fleet.ts
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: overlay/server.cjs
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
  - repo: pet
    path: tests/overlay-server.check.cjs
---

## What it does

If you keep several Claude Code conversations open, each one has its own band. Narsil makes every band show all of them.

There is one Narsil for all your conversations. Her drawing and her headline show the most important one, in this order: first an `ERROR`, then whatever `TE NECESITA` (needs you), then what is `TRABAJANDO` (working), and last what is `TERMINADA` (done). When that conversation is not the one you are looking at, the headline starts with its name, for example "web: Me he detenido por un error" ("web: I stopped on an error"). A conversation stuck on a question in another window therefore shows up in the one you are typing in.

Under her, the band lists every conversation, one row each: its state, its name and its own context bar with a percentage. The current conversation is always first, and its bar is blue so you can find it. The rows come four at a time, with ◂ and ▸ buttons to turn the page ("Conversaciones 1/2").

Pressing a conversation's name opens it under a line: its tasks, its subagents and, from its percentage, what fills its context. The next guide covers tasks and subagents.

A conversation you have not opened for a while stays in the list with its last state for an hour, even if the desktop app put it to sleep. After an hour without news it leaves the list, which is also how deleted conversations disappear. If you open it again, it comes back at once.

## How it works inside

### The problem: each conversation is alone

A mod runs once per conversation. Narsil in one conversation cannot see the atoms of Narsil in another. To show every conversation, something outside them has to collect the states and hand the list back.

Narsil already had such a thing: the small local server behind its floating window. The README says each conversation sends its state to "un pequeño servidor local (el de la ventana flotante)" (a small local server, the floating window's), which starts with the first conversation even when the window is turned off. That server is the hub.

### The hub: a Node script

`overlay/server.cjs` is a plain Node.js script, not mod code. It uses Node's `http` module, keeps one entry per conversation in a `Map` called `sessions`, and calls `server.listen(port, '127.0.0.1', ...)`, so it listens only on the local loopback address. The port is `47190` unless `NARSIL_PORT` says otherwise.

It answers, among others:

- **`POST /state`**: a conversation reports its state. The entry is stored with the time it arrived (`at`) and the time anything shown last changed (`changedAt`). Heartbeats that change nothing are not passed on to the floating window's page.
- **`GET /sessions`**: the list of every live conversation, most important first, without the drawings (each mod draws its own Narsil).

Both need the mod's token in the `x-narsil-token` header. The token is a random UUID the mod keeps in `$.store` (`overlayToken` in `hooks/register.tsx`) and passes to the server in the `NARSIL_TOKEN` environment variable when it starts it. The server also checks the `Host` header and refuses any name other than `127.0.0.1` and `localhost`. The guide on the floating window covers these protections in detail.

Two timers keep the list honest:

- `SESSION_FORGET_MS = 60 * 60_000`: `forgetSilent` drops a conversation one hour after its last heartbeat.
- `HEARTBEAT_TIMEOUT_MS = 30_000`: when no conversation at all has beaten for 30 seconds, the server shuts itself down. The next conversation starts it again.

### The mod's side: a heartbeat

In `session.start`, Narsil starts the hub shortly after the session begins (`$.clock.after(10, () => startOverlay($))`) and then beats every two seconds (`$.clock.every(2000, () => beat($))`). `startOverlay` first pings the server; if a server of an older version answers (it says something other than `narsil 4`), it stops it and starts a new one. On Windows it launches `node` with `overlay/server.cjs` through PowerShell's `Start-Process`; on macOS it runs `overlay/start.sh`.

Each `beat` does, among other housekeeping:

1. `pushOverlay`: `POST /state` with this conversation's state, built by `shownState` (id, title, mood, status, headline, context, tasks, subagent chips and more). The drawing goes along only when it changed; a server that has none answers `need-svg`.
2. `readSessions`: `GET /sessions`, cleaned field by field and written to the `sessions` atom only when it differs from what is already there.

Each change of mood also calls `pushOverlay` at once, through `setMood`, so the hub does not wait for the next beat.

The conversation's id comes from the `CLAUDE_CODE_HOST_SESSION_ID` environment variable, read in `session.start`. `ownId` accepts it only when it looks like `local_` followed by letters, digits and dashes, and otherwise uses `local_unknown`. The desktop app's `claude://code/continue` link opens a conversation by that id, which is how the floating window's "open" button works.

### Ranking: `hooks/fleet.ts`

The list logic is a separate file of pure functions, `hooks/fleet.ts`, with no events and no `$`. That makes it easy to test and to share with the band and the window.

- `RANK` gives each state its place: `error` 0, `waiting` 1, `working` 2, `done` 3, `idle` 4. The server uses the same order (`PRIORITY` in `overlay/server.cjs`).
- `fleetOf(hub, own)` takes the hub's list, replaces this conversation's entry with a fresh one (the hub's copy is up to a heartbeat old), and sorts by rank, then by the most recent change. The first entry is the one Narsil wears.
- `ownFirst(list, ownId)` moves this conversation to the front for the rows, whatever its state, so you always find it in the same place.
- `pageOf(list, page)` cuts the list into pages of `FLEET_PAGE = 4` and keeps the page number within range when conversations come and go.
- `fit(text, cells)` cuts or pads a title to `TITLE_CELLS` (26) characters, so every context bar starts in the same column.
- `openOf` and `toggleOpen` decide which conversation is open. `open: null` means "this one, by default"; an empty string means "none".

What the band shows open, which page it is on and whether the context breakdown is showing live in another atom, `view` (`fleetView` in `hooks/register.tsx`), so a press on ◂ or on a name is just an `update` of that atom.

### Why each decision was taken

- **Error before needs you before working before done.** The author's request ranks them this way (see below): the drawing is a warning first, so what failed or waits for you outranks what is merely busy.
- **Own conversation first in the rows, but not in the drawing.** The drawing answers "where am I needed?"; the rows answer "where is this one?". Keeping both lets the headline jump to another conversation while the list stays stable.
- **Pages instead of scrolling.** The task log's spec S3 says "The band cannot scroll (Box overflow is only visible/hidden): it pages instead." The 2.1.325 types now describe the `AbovePrompt` band scrolling a tree taller than its `maxRows`; Narsil still pages, and the floating window, which is a web page, scrolls.
- **One hour, not 30 seconds and not forever.** The commit history shows the expiry being tuned twice. `2ce3acb` (2026-11-07) "fix: keep sleeping conversations listed in the hub" explains that the desktop app puts the engine of a conversation you have not opened in a while to sleep, so its heartbeats stop and the hub dropped it after 30 seconds. The fix kept every conversation for as long as the server ran. Then `570961d` (2026-11-10) "fix: forget conversations silent for an hour in the hub" says deleted ones piled up, and settled on an hour: long enough for a sleeping one, short enough that a deleted one goes.
- **The hub's copy of yourself is replaced.** `fleetOf` and `ownEntry` use this conversation's fresh state, keeping the hub's `changedAt` only while the status holds, so your own row never lags a heartbeat behind.

## How it was asked of the AI

This feature has a public task log: `odd/tasks/fleet-view.md` in narsil-pet, entries L1 to L13. It quotes the author's requests word for word.

The original request, L1, dated 2026-11-06:

> "quiero hacerlo en los dos y tambien en la ventana externa, el diseno lo pensamos luego, quisiera poder mostrar todas las sesiones en curso y sus estados, la imagen de narsil solo mostraria lo mas importante error->te necesita-> trabajando--> termine, y las notificaciones se enviarian al celular cuando se pida algo desde el celular como ahora y haya cambios, es decir alguna tarea pase de trabajando a terminado, o de trabajando a error, etc, (eliminariamos la alerta de bucle, no la he sentido tan util) las notificaciones del celular cuando se envien llevarian la info de todas las sesiones funcionando en ese momento, algo asi es mi idea, como lo hacemos? los consejos seguirian funcionando como ahora en cada ventana"

In English: the author wants this in both places (the band and the desktop) and also in the external floating window, with the design left for later. They want to show every running session and its state; Narsil's picture would show only the most important one, in the order error, needs you, working, finished. Phone notifications would go out, as now, when a request came from the phone and something changed (a conversation going from working to finished, or from working to error); the loop alert would be removed because it had not felt useful; and each phone notification would carry every session running at that moment. The author closes by asking how to do it, and says the tips should keep working as before in each window.

The corrections that followed, and what they changed:

- **L2** (excerpt): "deberiamos ver en la ventana principal tanto en la banda como la ventana externa el estado de todas las conversaciones, con scroll si son muchas, [...] donde ponemos las barras de cada conversacion con su porcentaje de avance y con sus estados? al hacer click en el titulo de conversacion deberiamos poder ver sus sub agentes/ tareas y sus respectivos estados". In English: both the band and the external window should show every conversation's state, scrolling when there are many; the author asks where each conversation's bar should go; and clicking a conversation's title should show its subagents and tasks with their states. The same entry removes the closing "open conversations" section and the money section, and keeps the cache. This produced the rows, the clickable titles and the open conversation's detail; since the band could not scroll, it became paging.
- **L3**: "entonces otro cambio, me parece bien lo que me dices del contexto, entonces la barra de contexto general tambien se iria por que no existe un contexto general y se reemplazaria por las barras de contexto de cada conversacion, el avance entonces no existe cuando entre a una de esas conversaciones estaria de nuevo su contexto, sus tareas con su estado (no es necesario barra de avance) y sus sub agentes, al clickear aca su contexto veria como se lleno su propio contexto y ya". In English: the author agrees with the point about context, so the general context bar goes, because there is no general context; each conversation has its own bar instead. Opening a conversation shows its context, its tasks with their states (no progress bar needed) and its subagents, and clicking its context shows how that context filled. This removed the general context bar and put a bar in every row.
- **L4** records the agreed design: Narsil and the headline of the conversation that matters on top, the account limits once, the list of conversations, a row that opens to its context, tasks and subagents, and "The band pages 4 rows at a time."
- **L6 to L11** record each task as done, with its evidence. L6 describes the hub: the server now starts with every conversation, window or not, and `GET /sessions` (token only) lists every live conversation, "error first, then waiting, working, done, idle".
- **L12** and **L13** report and fix a bug with task states, covered in the next guide.

The one-hour expiry was not part of the log; it came after it, in the two commits described above.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> My Claude Code mod `my-pet` shows one conversation's state in the `AbovePrompt` band. Make it show every open conversation. Write a small Node.js hub (`hub.cjs`) that listens only on 127.0.0.1, takes `POST /state` and serves `GET /sessions`, both behind a random token the mod keeps in `$.store`, and forgets a conversation one hour after its last report. In the mod, report this conversation's state every two seconds with `$.clock.every` and `$.http.fetch`, read the list back into an atom, and keep the ranking and paging as pure functions in `hooks/fleet.ts`: error, then waiting, then working, then done, then idle, newest change first, four rows a page. Draw the most important conversation's state at the top and the rows below, this conversation first. Add tests for the ranking, the paging and the expiry.

## The minimal code

Written for this guide. The ranking and paging are adapted from `hooks/fleet.ts`, and the hub's expiry and order from `overlay/server.cjs`, both in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later).

The pure part, `hooks/fleet.ts`:

```ts
import type { Entry, Status } from '../types' // Entry: { sessionId: string; status: Status; headline: string; changedAt: number }

export const PAGE = 4
const RANK: Record<Status, number> = { error: 0, waiting: 1, working: 2, done: 3, idle: 4 }

export function ranked(hub: readonly Entry[], own: Entry): Entry[] {
  return [own, ...hub.filter((s) => s.sessionId !== own.sessionId)].sort(
    (a, b) => RANK[a.status] - RANK[b.status] || b.changedAt - a.changedAt,
  )
}

export function pageOf(list: readonly Entry[], page: number) {
  const pages = Math.max(1, Math.ceil(list.length / PAGE))
  const at = Math.min(Math.max(0, page), pages - 1)
  return { rows: list.slice(at * PAGE, (at + 1) * PAGE), page: at, pages }
}
```

The mod's heartbeat, in `hooks/register.tsx` (the `fleet` atom holds the hub's list and is declared in `types/index.d.ts`; `ownEntry` builds this conversation's entry from your state atom):

```ts
const HUB = 'http://127.0.0.1:47191'

async function token($: EngineInterface): Promise<string> {
  const saved = await $.store.get('hubToken')
  if (typeof saved === 'string' && saved) return saved
  const fresh = crypto.randomUUID()
  await $.store.set('hubToken', fresh)
  return fresh
}

async function beat($: EngineInterface): Promise<void> {
  const headers = { 'content-type': 'application/json', 'x-my-pet-token': await token($) }
  try {
    await $.http.fetch(`${HUB}/state`, {
      method: 'POST',
      headers,
      body: JSON.stringify(await ownEntry($)),
    })
    const { ok, text } = await $.http.fetch(`${HUB}/sessions`, { headers })
    if (ok) await update($, fleet, () => JSON.parse(text))
  } catch {
    // the hub is out of reach: keep the last list
  }
}

// in register:
on('session.start', async ($, e, next) => {
  $.clock.every(2000, () => beat($))
  return next(e)
})
```

For the id in `ownEntry`, `$.session.id()` returns the session's id (the transcript file's name). Narsil uses `CLAUDE_CODE_HOST_SESSION_ID` instead because it needs the desktop app's `local_` id to open the conversation from a link.

The hub, `overlay/hub.cjs`, is plain Node.js, not mod API. The mod starts it with `$.process.run`, passing the token as `MY_PET_TOKEN` in `env`; Narsil's `startOverlay` shows how to launch it detached on Windows and macOS.

```js
'use strict'
const http = require('http')
const token = process.env.MY_PET_TOKEN || ''
const RANK = { error: 0, waiting: 1, working: 2, done: 3, idle: 4 }
const FORGET_MS = 60 * 60_000
const sessions = new Map()

http
  .createServer((req, res) => {
    if (!token || req.headers['x-my-pet-token'] !== token) return res.writeHead(403).end()
    if (req.method === 'GET' && req.url === '/sessions') {
      const now = Date.now()
      for (const [id, s] of sessions) if (now - s.at > FORGET_MS) sessions.delete(id)
      const list = [...sessions.values()].sort(
        (a, b) => (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9) || b.changedAt - a.changedAt,
      )
      return res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(list))
    }
    if (req.method !== 'POST' || req.url !== '/state') return res.writeHead(404).end()
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 100_000) req.destroy()
    })
    req.on('end', () => {
      try {
        const s = JSON.parse(body)
        const before = sessions.get(String(s.sessionId))
        const changedAt = before && before.status === s.status ? before.changedAt : Date.now()
        sessions.set(String(s.sessionId), { ...s, at: Date.now(), changedAt })
        res.writeHead(204).end()
      } catch {
        res.writeHead(400).end()
      }
    })
  })
  .listen(47191, '127.0.0.1')
```

This sketch leaves out what the real server adds: the `Host` check, shutting down when every conversation is silent, and the floating window. Do not widen `'127.0.0.1'` to all interfaces; the later guide on the floating window explains why each protection is there.

## Common mistakes and how to test it

- **Dropping sleeping conversations.** The desktop app stops the engine of a conversation you have not opened in a while, so its heartbeats stop although it still exists. A short timeout empties your list (`2ce3acb`).
- **Never forgetting.** Keeping every conversation for as long as the hub runs fills the list with deleted ones (`570961d`). Expire by the time since the last heartbeat, and let the first new heartbeat list it again.
- **Showing your own conversation a beat late.** The hub's copy is old by up to one heartbeat. Merge your fresh entry in before ranking, as `fleetOf` does.
- **A page that no longer exists.** When conversations leave, the stored page can point past the end. Clamp it, as `pageOf` does.
- **Rewriting the atom every beat.** Each `update` redraws the band. Narsil compares the new list with the old one and writes only on a difference.
- **Throwing when the hub is down.** A failed `$.http.fetch` must not break the mod. Narsil catches it, keeps the last list, and tries to start the hub again at most once a minute (`ensureOverlay`).
- **An old hub answering for a new mod.** The server outlives the mod's updates. Narsil's `/ping` answers a protocol string (`narsil 4`), and the mod replaces a server that answers another one.
- **Several terminals without a host id.** `ownId` falls back to `local_unknown` when `CLAUDE_CODE_HOST_SESSION_ID` is missing or does not match, and the server does the same, so such conversations share one entry.

To test the mod, `claude plugin test .` runs `tests/narsil.test.tsx`, which feeds a made-up hub through a mocked `$.http.fetch`. Look at "the band lists every open conversation with its state and context, and Narsil wears the most important" and "the band pages through many conversations, four at a time", which presses the `page-next` button and checks "Conversaciones 2/2". To test the server, `node tests/overlay-server.check.cjs` starts the real script and checks, among others, "every conversation is served to the mods alone, the most important first, without drawings" and "a conversation that stops beating stays listed for an hour, then goes until it beats again", which moves `Date.now` forward 59 and 61 minutes.

## Going further

- `hooks/fleet.ts` also has `countOfStates`, which `/narsil estado` uses to say how many conversations are in each state.
- The `ui.render` hook on `AbovePrompt` in `hooks/register.tsx` draws the rows: a fixed-width state column, the title as a `Button` that calls `toggleOpen`, `textBar` for the context, the percent as a button for the open conversation, and the cache clock. Next steps on offer close every conversation until you open one.
- `shownState` is the full entry each conversation reports; `readSessions` shows how to validate what comes back from the hub field by field.
- `overlay/server.cjs` also broadcasts the list to the floating window over server-sent events (`GET /events`), opens the window when an event waits for you, and serves its page. The floating-window guide covers it.
- The phone alerts use the same list: `fleetNow` and `fleetText` end each alert with every open conversation and its state.
