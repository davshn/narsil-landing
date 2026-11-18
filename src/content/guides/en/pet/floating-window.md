---
title: The floating window
description: 'How Narsil shows an always-on-top window when Claude is minimized or something waits for you, and why its local server listens only on 127.0.0.1 behind a page key and a mod token.'
route: pet
order: 5
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: overlay/server.cjs
  - repo: pet
    path: overlay/overlay.html
  - repo: pet
    path: overlay/watch.ps1
  - repo: pet
    path: overlay/mac-claude.js
  - repo: pet
    path: overlay/start.sh
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: odd/tasks/animated-poses.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/overlay-server.check.cjs
---

## What it does

The band above the prompt only helps while you are looking at Claude. Once you minimize it to read a page or answer a message, a finished turn or a question goes unseen.

The floating window fills that gap. It is a small window, 330 by 450 pixels, that:

- **Appears when Claude is minimized** (or closed), and **hides by itself** when you come back to Claude.
- **Appears when something waits for you**, even if Claude is only behind another app: a question, a permission, an error, or a finished turn.
- **Stays on top** of other windows on Windows, in the corner of the screen Claude is on, without taking the keyboard focus from what you are doing.
- Shows Narsil with the most important conversation (or the one whose alert is waiting), the account limits, and every open conversation in a list that scrolls. Pressing a conversation opens its context, tasks, subagents, cache and next steps, with a button that brings that conversation to the front in the desktop app.

A "done" alert leaves by itself after 20 seconds; a question or an error stays until you look at Claude or dismiss it. If you close the window, the next alert brings it back, but not sooner than a minute after you closed it. `/narsil flotante` turns the window on or off, and `/narsil prueba` sends a test alert that shows even while you look at Claude.

On macOS the window behaves a little differently, as the README explains: it is opened and closed instead of hidden (hiding another app's window would need the accessibility permission), it opens behind the app in use, and it does not stay on top. The browser remembers where you put it. On other systems there is no window; the band, the voice and Claude Code's notifications remain.

## How it works inside

Four pieces, each with one job:

| Piece                                       | What it is                     | Its job                                                                          |
| ------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------- |
| The mod (`hooks/register.tsx`)              | Mod code, one per conversation | Starts the hub, reports this conversation's state, sends alerts                  |
| The hub (`overlay/server.cjs`)              | A plain Node.js script         | Keeps every conversation's state, serves the page, decides when the window shows |
| The page (`overlay/overlay.html`)           | A web page in a browser window | Draws Narsil and the list, sends your presses back                               |
| The keeper (`watch.ps1` or `mac-claude.js`) | A system script                | Watches the Claude window and shows, hides or positions the browser window       |

The hub is the same server the previous guide calls the hub: it collects every conversation's state. This guide looks at its other half, the window.

### Starting the hub and the window

In `session.start` the mod calls `startOverlay` a moment after the session begins. It pings `http://127.0.0.1:47190/ping` with `$.http.fetch`; if the server answers `narsil 4` it is already running. If an older version answers, the mod stops it first, since a server outlives the mod's updates.

Otherwise it starts one, passing three values in the environment: `NARSIL_TOKEN` (the mod's token, below), `NARSIL_PORT` (`47190`) and `NARSIL_WINDOW` (`1` when the floating window is on, `0` when it is off). The process is started detached, so it outlives the hook that started it:

- **On Windows**, through `$.process.run` running PowerShell, which finds Node and Microsoft Edge and calls `Start-Process` on `node overlay/server.cjs`. Edge's path goes in `NARSIL_EDGE`.
- **On macOS**, through `$.process.run` running `overlay/start.sh`, which looks for Chrome, Edge or Brave and for Node in the usual places, then starts the server with `nohup ... &`.

Without a browser the server still runs and serves the conversations; there is just no window.

When the window is wanted, the server opens the browser in app mode, with no address bar or tabs: `--app=http://127.0.0.1:47190/`, its own profile folder (`--user-data-dir`, under `%LOCALAPPDATA%\narsil-overlay` on Windows) and `--window-size=330,450`. It also passes `--disable-background-timer-throttling` and two similar flags, because the window is hidden most of the time and must still update at once when it shows.

### The keeper: is Claude minimized?

A web page cannot see other windows, and Node cannot either without help. So a small system script watches the Claude window and asks the hub what to do.

On Windows, `overlay/watch.ps1` runs in a loop every 400 ms. It finds the window of the process `claude` titled `Claude`, and the Edge window titled `Narsil`, through a few `user32.dll` calls. It classifies Claude as:

- `min`: minimized or not visible.
- `fg`: the foreground window.
- `bg`: visible but behind another app.
- `gone`: no Claude window at all.

It then calls `GET /tick?claude=<state>&window=<0|1>` with the mod's token, and carries out each line of the answer: `show` places the window at the bottom right of the screen Claude was last seen on, 16 pixels from the edge, with `SetWindowPos` and the flags for "topmost" and "do not activate"; `hide` hides it; `open <link>` brings Claude forward and opens a conversation link. After five failed calls in a row (the server is gone), it exits.

On macOS, `overlay/mac-claude.js` is a JavaScript for Automation script run with `osascript -l JavaScript`. Every 700 ms it reads the window list from Core Graphics and prints `fg`, `bg` or `none`. The file's comment explains the choice: the window list names each window's app with no permission, while window titles would need one. Here the keeper's logic lives in the server itself (`keepMac`): `none` becomes `min`, or `gone` when `pgrep -x Claude` finds no process.

### Deciding when to show

The decision is one function, `tick`, in `overlay/server.cjs`:

- The window should show when Claude is `min` or `gone`, or when an event is waiting.
- An event is cleared when you look at Claude (`fg`), and a `done` event after 20 seconds (`DONE_EVENT_MS`).
- `show` or `hide` is sent only when the wanted state changes, so a window you dragged stays where you put it.

Events come from the mod through `POST /event`, with a kind of `done`, `question` or `error`. The server ignores an event that arrives while you are looking at Claude, unless it is forced (the `/narsil prueba` test and the five-minute "still waiting" reminder). If you closed the window, an event opens it again only after `REOPEN_AFTER_CLOSE_MS`, 60 seconds.

### Server-sent events: how the page stays current

The page does not ask the server for updates every second. It opens one long connection with `new EventSource('/events')`. The server answers with the content type `text/event-stream`, writes the current snapshot at once, and keeps the connection open. Each later change is written to every open connection as a line `data: <json>` followed by a blank line (`broadcast`).

This is the server-sent events format: a one-way stream from server to page over plain HTTP. It suits the window well. The browser reconnects by itself if the connection drops, and the server sends only when something shown changed: a heartbeat that changes nothing is not broadcast.

The snapshot carries every live conversation and the waiting event. The page draws the text with `textContent`, never as HTML, and draws Narsil's SVG as an image from a `Blob` URL, a way of showing a picture in which scripts inside the SVG do not run.

The page's own actions are small `POST` requests: `/open` (bring a conversation forward, through the keeper), `/dismiss` (clear the event) and `/bounds` (where the window is on screen, used on macOS to place the tip window above it).

### Security: who may talk to the hub

The hub runs on your computer and knows what every conversation is doing. It is built so that only three things can use it: the mod, the keeper and its own page. Four protections do this, all in `overlay/server.cjs`.

**1. It listens only on the loopback address.** The last lines of the file are:

```js
server.listen(port, '127.0.0.1', () => {
  if (isWindowWanted) openWindow()
})
```

`127.0.0.1` is the address a computer uses to talk to itself. A server bound to it accepts connections only from programs on the same machine. Another computer on your Wi-Fi or office network cannot open a connection to it at all, whatever it sends.

**2. The mod's token.** The mod creates a random token with `crypto.randomUUID()` the first time and keeps it in `$.store` under `overlayToken` (`overlayToken` in `hooks/register.tsx`), so every conversation uses the same one. It reaches the server only through the `NARSIL_TOKEN` environment variable when the mod starts it, and the server hands it to `watch.ps1` the same way. Each request of the mod or the keeper carries it in the `x-narsil-token` header. The server compares it (`isTrusted`) and refuses with `403` when it is missing or wrong; an empty token never matches.

**3. The page's key.** The page cannot be given the mod's token: anything inside a web page is visible to whoever loads that page. So the server makes a second secret for the page: `PAGE_KEY`, 16 random bytes from Node's `crypto.randomBytes`, new each time the server starts. It writes the key into the page where `overlay.html` has the placeholder `__NARSIL_KEY__` (a `<meta name="narsil-key">` tag), and the page sends it back in the `x-narsil-page` header with each of its actions. The server's comment gives the reasoning: a page of another site cannot read this one, so it cannot learn the key.

**4. The `Host` check.** Before anything else, the server refuses with `403` any request whose `Host` header is not `127.0.0.1:47190` or `localhost:47190`. This stops DNS rebinding, an attack in which a website makes its own name point to `127.0.0.1`. The browser then sends that website's requests to your local server, but under the website's name in `Host`, and the server turns them away.

Which route needs what:

| Route                                                    | Needs                          |
| -------------------------------------------------------- | ------------------------------ |
| `GET /ping`, `/`, `/icon.png`, `/favicon.ico`, `/anim/…` | Only the right `Host`          |
| `GET /events` (the stream), `GET /window` (the bounds)   | Only the right `Host`          |
| `POST /open`, `/dismiss`, `/bounds`                      | The page key, or the mod token |
| `GET /sessions`, `GET /tick`                             | The mod token                  |
| `POST /state`, `/event`, `/window`, `/quit`              | The mod token                  |

Two more details: links are checked twice before anything opens them, by the server (`LINK`, `conversationLink`) and again by `watch.ps1`, and both accept only `claude://code/continue?session=local_…&source=desktop_action`. And request bodies over a million characters are cut off (`readBody`).

### The threat model in plain words

Who is the server protecting you from?

- **A website you visit.** Your browser will send requests from any page to `127.0.0.1`. But the page cannot read the answers from another origin (the server sends no headers that allow it), so it cannot read the stream or the key. It does not know the key or the token, so every action and every write refuses it. And a rebound name fails the `Host` check.
- **Another computer on the network.** It cannot connect, because the server listens only on `127.0.0.1`.
- **Programs on your own computer.** These are not kept out. Any local program can read `/events`, and it can read the page key by loading `/`, just as the window does. The token protects the mod's routes from them, but a program already running as you can read much more than this server holds. The design protects you from the web and the network, not from software you already run.

### Why it must never be exposed to the network

The loopback address is the protection that the other three rest on. The page key and the `Host` check work because only a browser's rules stand between a stranger and the server, and a browser follows those rules. A program on another computer does not:

- It could write any `Host` header it likes, so the `Host` check would not stop it.
- It could load `/` and read the page key from the page, then use the page's actions: open conversations on your desktop and dismiss your alerts.
- It could read `/events` freely. That stream carries every conversation's title, headline, tasks, subagents, context, tip, next steps, and the alert texts, which include a summary of Claude's last answer.

The project's folder names, task lists and pieces of Claude's answers are exactly what you would not want read by whoever shares your café's Wi-Fi. The token would still guard `/state` and `/sessions`, but the stream alone gives away most of the same content. So the rule is simple: the hub listens on `127.0.0.1` and nowhere else.

## Build it with Claude

Ask Claude for a small local server that the mod starts, and a page that shows the state in a window of its own. The one idea it must get right is that the server listens only on `127.0.0.1` and checks who is talking to it on every request.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> My Claude Code mod `my-pet` shows Claude's state in the band. Add a floating window for when Claude is minimized. Write a Node.js server, `overlay/hub.cjs`, that listens only on 127.0.0.1, refuses any `Host` header other than `127.0.0.1:<port>` and `localhost:<port>`, serves one HTML page with a random key written into it, streams the state to that page with server-sent events at `/events`, and accepts `POST /state` only with a token the mod creates with `crypto.randomUUID()`, keeps in `$.store` and passes in an environment variable when it starts the server detached with `$.process.run`. The page's own actions must carry its key. Never listen on any other address. Add a Node test that checks a wrong `Host`, a missing token and a missing key are each refused with 403, and that a request line like `GET // HTTP/1.1` does not crash the server.

### What to check in Claude's answer

1. The server calls `listen` with `'127.0.0.1'` as the host, never with the port alone.
2. Any request whose `Host` header is not `127.0.0.1:<port>` or `localhost:<port>` is refused with `403`.
3. The mod's token never appears in the page. The page gets its own random key, new each time the server starts, and sends it back with each of its actions.
4. Parsing that can throw, such as `new URL()`, is wrapped, so a request line like `GET // HTTP/1.1` gets an answer and the server keeps running.
5. The server is started detached, so `$.process.run` does not wait for it to end.

If a check fails, tell Claude what you see: "the hook that starts the server waits until it times out, and the band stops updating meanwhile".

### How the author asked for it

The original request for the floating window was not recorded. It arrives in the commit `6f8f938` (2026-10-30) "feat(overlay): add floating window, Spanish voice and Windows toasts", together with the voice and the notifications of the next guide, before any public task log existed.

#### Later requests, recorded in the task logs

The window was reshaped by the fleet view, whose log is `odd/tasks/fleet-view.md` in narsil-pet. L1 (2026-11-06) opens with:

> "quiero hacerlo en los dos y tambien en la ventana externa, el diseno lo pensamos luego"

In English: the author wants it in both places, and also in the external window, with the design left for later. The previous guide quotes this entry whole.

L2 (excerpt) asks for the list:

> "deberiamos ver en la ventana principal tanto en la banda como la ventana externa el estado de todas las conversaciones, con scroll si son muchas"

In English: both the band and the external window should show every conversation's state, scrolling when there are many. That is why the window scrolls while the band pages. L6 records the change to the server that followed: it now starts with every conversation, window or not, "Closing the window no longer quits the server; an event reopens a wanted window after 60 s." L8 records the page's new layout, checked in the browser at 330×450 against four made-up conversations, and notes: "No automated test covers the page's own script."

The sharp loops came from `odd/tasks/animated-poses.md`, L6 (2026-11-15):

> "en ventana externa podemos poner el video sin recortar? para que se vea mas nitido?"

In English: can the external window show the video uncropped, so it looks sharper? The log records the approval, "Sí, hazla" ("Yes, do it"), and its spec S7 says the window has no size limit, so the local server serves a sharper copy of each loop. That is the `/anim/` route.

#### Reconstruction from the commit history

The rest, from `git log -- overlay/server.cjs overlay/overlay.html overlay/watch.ps1 overlay/mac-claude.js overlay/start.sh`:

- `6f8f938` (2026-10-30) "feat(overlay): add floating window, Spanish voice and Windows toasts". The server, already on `127.0.0.1` and with the mod's token on its write routes, the page, `watch.ps1` and `kill.ps1`.
- `a2b5970` (2026-10-30) "fix(overlay): start the window again for an event instead of a notification".
- `c8bf365` (2026-10-30) "feat(mac): open the floating window on macOS in a Chromium browser".
- `9bb60c8` (2026-10-30) "fix(overlay): show the floating window on the screen Claude is on".
- `42f7efd` (2026-10-31) "fix: let only the floating window's own page and the mod drive its server". This commit added the page key and the `Host` check. Before it, the page's actions took no key and there was no `Host` check, so a page of any website you visited could send them a plain request and, for example, dismiss your alerts. It also added the security checks in `tests/overlay-server.check.cjs`.
- `3031ef2` (2026-11-01) "fix(overlay): on macOS show the window when Claude is minimized, not when another app is in front, and open only one".
- `aa54891` and `b87bd67` (2026-11-06): the server becomes the hub of every conversation, and the window lists them all.
- `42aab0c` (2026-11-07) "fix: open the floating window once when Edge hands it to a running instance".
- `e19331b` (2026-11-15) "feat: show sharper animated loops in the floating window".
- `f2cc0f6` (2026-11-16) "fix: answer 400 to a request path that makes no URL instead of crashing the overlay server". Its message explains that a raw request line such as `GET // HTTP/1.1` made `new URL()` throw inside the async handler, which ended the process. A single odd request could stop the hub for every conversation.

The pattern: the window came first, then its behavior on each system, then its security, and a late fix found by sending the server a request no browser would send.

## Reference code

This is one correct answer, written for this guide. Read it to understand how the pieces fit together and to compare it with what Claude wrote for you: Claude may choose other names or another order and still be right.

A reduced hub, written for this guide and adapted from `overlay/server.cjs` and `hooks/register.tsx` in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). The server is plain Node.js, not mod code. Showing and hiding the window is left out: that part depends on the system, as the keepers above show.

The server, `overlay/hub.cjs`:

```js
'use strict'
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const path = require('path')

const port = Number(process.env.PET_PORT || 47190)
const token = process.env.PET_TOKEN || ''
const PAGE_KEY = crypto.randomBytes(16).toString('hex')
const PAGE = fs
  .readFileSync(path.join(__dirname, 'page.html'), 'utf8')
  .replace('__PAGE_KEY__', PAGE_KEY)
const HOSTS = new Set([`127.0.0.1:${port}`, `localhost:${port}`])

let state = null
const listeners = new Set()

const server = http.createServer((req, res) => {
  const send = (status, type, body) => {
    res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' })
    res.end(body)
  }
  let url
  try {
    url = new URL(req.url, `http://127.0.0.1:${port}`)
  } catch {
    return send(400, 'text/plain', 'bad request')
  }
  if (!HOSTS.has(String(req.headers.host || '').toLowerCase()))
    return send(403, 'text/plain', 'forbidden')
  const isMod = token !== '' && req.headers['x-pet-token'] === token
  const isPage = isMod || req.headers['x-pet-page'] === PAGE_KEY

  if (req.method === 'GET' && url.pathname === '/') return send(200, 'text/html', PAGE)
  if (req.method === 'GET' && url.pathname === '/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store' })
    res.write(`data: ${JSON.stringify(state)}\n\n`)
    listeners.add(res)
    req.on('close', () => listeners.delete(res))
    return
  }
  if (req.method === 'POST' && url.pathname === '/dismiss') {
    if (!isPage) return send(403, 'text/plain', 'forbidden')
    return send(204, 'text/plain', '')
  }
  if (req.method === 'POST' && url.pathname === '/state') {
    if (!isMod) return send(403, 'text/plain', 'forbidden')
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 100_000) req.destroy()
    })
    req.on('end', () => {
      try {
        state = JSON.parse(body)
      } catch {
        return send(400, 'text/plain', 'bad json')
      }
      for (const l of listeners) l.write(`data: ${JSON.stringify(state)}\n\n`)
      send(204, 'text/plain', '')
    })
    return
  }
  send(404, 'text/plain', 'not found')
})

server.on('error', () => process.exit(0))
server.listen(port, '127.0.0.1')
```

The page reads its key from `<meta name="pet-key" content="__PAGE_KEY__">`, listens with `new EventSource('/events')`, sets text with `textContent`, and sends its actions with `fetch('/dismiss', { method: 'POST', headers: { 'x-pet-page': key } })`.

The mod's side, in `hooks/register.tsx`, checked against the 2.1.325 types (`$.store`, `$.process.run`, `$.http.fetch`, `$.plugin.root`, `$.clock.every`). It starts the hub on macOS or Linux in the way Narsil's `launch` does; on Windows, Narsil uses PowerShell's `Start-Process` instead.

```tsx
import { read } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const HUB = 'http://127.0.0.1:47190'

async function hubToken($: EngineInterface): Promise<string> {
  const saved = await $.store.get('hubToken').catch(() => undefined)
  if (typeof saved === 'string' && saved) return saved
  const token = crypto.randomUUID()
  await $.store.set('hubToken', token)
  return token
}

async function startHub($: EngineInterface): Promise<void> {
  const up = await $.http.fetch(`${HUB}/`).then(
    (r) => r.ok,
    () => false,
  )
  if (up) return
  await $.process.run(['/bin/sh', '-c', 'nohup node "$PET_HUB" </dev/null >/dev/null 2>&1 &'], {
    env: { PET_HUB: `${$.plugin.root}/overlay/hub.cjs`, PET_TOKEN: await hubToken($) },
  })
}

async function push($: EngineInterface): Promise<void> {
  await $.http
    .fetch(`${HUB}/state`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-pet-token': await hubToken($) },
      body: JSON.stringify(await read($, pet)),
    })
    .catch(() => undefined)
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await startHub($)
    $.clock.every(2000, () => void push($))
    return next(e)
  })
}
```

`pet` is the state atom from the first guide. The shell command is a fixed string; the script's path travels in the environment, never inside the command, which is how Narsil keeps text out of what a shell would interpret.

## Common mistakes and how to test it

- **Listening on every address.** `server.listen(port)` with no host listens on all of the computer's addresses, the network included. Always pass `'127.0.0.1'`.
- **Putting the mod's token in the page.** Whatever a page contains, anyone who loads it can read. Give the page its own key, new each run, and keep the token for the mod.
- **Trusting `Host` as the only protection.** It stops a browser being tricked through DNS rebinding. It does not stop a program that writes its own headers, which is why the loopback address matters.
- **An async handler that throws.** In Node, an exception inside an `async` request handler becomes an unhandled rejection that can end the process. Wrap the parsing that can throw, as `f2cc0f6` did with `new URL()`.
- **Passing text in a command line.** Narsil's scripts take their text from the environment (`NARSIL_TEXT`, `NARSIL_TOKEN`), so a title Claude wrote can never be read as part of a command.
- **Stealing focus.** A window that jumps to the front interrupts typing. On Windows, `watch.ps1` passes "do not activate" to `SetWindowPos`.
- **Waiting on a process that never ends.** `$.process.run` reads the whole output; a server started without detaching holds the call until its timeout. Start it with `nohup … &` or `Start-Process`.

To test, narsil-pet runs `node tests/overlay-server.check.cjs`. Its checks include "the page is served with its key, and the key is not a placeholder", "another host name (a page rebound to this address) is refused everywhere", "the page's actions need its key", "the mod's state needs its token, as before" and "a request path no URL can be made of is refused, and the server keeps answering". The mod side is covered in `tests/narsil.test.tsx` by "each state change is pushed to the floating window with its token and session", "an older window server left running is closed and replaced by this version" and "with the window off, the conversation still reaches the hub: started with no window, and pushed to". The task log notes that no automated test covers the page's own script or a real browser window opening.

## Going further

- `openWindow`, `checkWindowGone` and `isProfileRunning` in `overlay/server.cjs` handle Edge handing a launch to an instance already running, which would otherwise open a second window (`42aab0c`).
- `kill.ps1` and `running.ps1` find the browser's processes by its profile folder, so the server closes only its own window.
- `HEARTBEAT_TIMEOUT_MS` (30 seconds) shuts the server down when no conversation beats; `ensureOverlay` in `hooks/register.tsx` starts it again at most once a minute.
- The tip window (`overlay/tip.ps1`, `overlay/tip.sh`, `overlay/tip.js`) opens above the floating window using the bounds the page reports.
- The README's "Sistemas compatibles" table sums up what each system gets.
