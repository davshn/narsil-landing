---
title: The $ object
description: The areas of the engine interface every hook receives, with their real signatures and where narsil-pet and narsil-check use each one.
route: mods
order: 2
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: types/index.d.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: types/index.d.ts
---

## What it does

Every hook receives `$`, the engine interface. A mod has no Node and no DOM, so `$` is how it reaches the screen, its saved data, the clock, the network, processes, files, the session, the model, tools and commands. This guide walks through the areas the two Narsil mods use, with each method's signature as Claude Code 2.1.325 declares it.

`$` has more than what is here (themes, settings, agents, telemetry and others). The declaration file, `claude-code.d.ts`, documents every noun and method with its doc comment and an example.

## How it works inside

Each method on `$` is a call through the host: it is raised as an event, so other plugins' hooks can see it, rewrite it or refuse it, and almost every method returns a promise. Types come from the `claude-code` module:

```ts
import type { EngineInterface } from 'claude-code'
```

A helper that takes `$: EngineInterface` can use the same calls as a hook.

| Area        | What it is for                                                                          | Used in                                |
| ----------- | --------------------------------------------------------------------------------------- | -------------------------------------- |
| `$.ui`      | Toasts, notifications, log lines, the status line, panes, the clipboard, element tables | both                                   |
| `$.store`   | JSON data kept between sessions                                                         | both                                   |
| `$.state`   | Named values for the session, read while drawing                                        | both, through `atom`, `read`, `update` |
| `$.clock`   | The time and timers                                                                     | both                                   |
| `$.process` | Commands on the host                                                                    | both                                   |
| `$.http`    | Network requests through the host                                                       | both                                   |
| `$.fs`      | Files                                                                                   | both                                   |
| `$.session` | The session's directory, id, usage and surfaces                                         | both                                   |
| `$.model`   | One-off completions                                                                     | both                                   |
| `$.tool`    | Tools the model can call                                                                | narsil-check                           |
| `$.command` | Slash commands                                                                          | both                                   |
| `$.mcp`     | Calling a connected MCP server's tools                                                  | narsil-check                           |
| `$.prompt`  | The prompt box and submitting prompts                                                   | both                                   |
| `$.audio`   | Speech and sound                                                                        | narsil-pet                             |
| `$.env`     | Environment variables                                                                   | narsil-pet                             |
| `$.plugin`  | The plugin's own name and folder                                                        | narsil-pet                             |

## Step by step

### $.ui: what the person sees

```ts
$.ui.toast('Saved 3 notes')
$.ui.log('greeter: cache warmed', { to: 'debug' })
$.ui.status('greeter: 2 tool calls')
$.ui.status(undefined)

const sent = await $.ui.notify('Tests passed', { title: 'greeter' })
if (!sent.isSent) $.ui.log(`no notification: ${sent.reason}`)

const opened = await $.ui.open({ id: 'notes', title: 'Notes' })
if (!opened.isPlaced) $.ui.log(`pane waits: ${opened.reason}`)
```

- `toast(text, options?)` shows a small box for a few seconds (`timeoutMs`, default 4000). It does not touch the transcript or the model.
- `log(text, options?)` appends a dim line to the transcript that the model does not read, or with `{ to: 'debug' }` writes to the debug log only.
- `status(text | undefined)` pins one line for this plugin under the prompt; `undefined` removes it.
- `notify(text, options?)` raises a native notification through the person's own channel and resolves `{ isSent: true, channel }` or `{ isSent: false, reason }`.
- `open(pane)` opens a pane the plugin then draws with a `ui.render` hook on `{ component: 'Pane' }`. It resolves `{ isPlaced: true }` or `{ isPlaced: false, reason }`.
- `copy({ text, surface })` puts text on the clipboard of the surface named, and resolves `{ isCopied: true }` or `{ isCopied: false, reason }`. A press handler passes `e.surface`.
- `resolve(e)` returns the element table (`Box`, `Text`, `Button` and others) for the surface a `ui.render` hook draws on. The guide "Surfaces" covers it.

narsil-check's `hooks/register.tsx` uses `$.ui.copy` and `$.ui.toast` together in `copyRow`, and opens its pane with `$.ui.open({ id: PANE, title: TITLE })` on `session.start`. narsil-pet's `hooks/register.tsx` tries `$.ui.notify` before its own notification script. Neither mod calls `$.ui.status`; the line above follows the declaration file's example.

### $.store: data across sessions

```ts
const runs = Number((await $.store.get('runs')) ?? 0) + 1
await $.store.set('runs', runs)

const old = (await $.store.keys()).filter((key) => key.startsWith('day:'))
for (const key of old) await $.store.delete(key)
```

- `get(key)` resolves the value or `undefined`. Its type is `unknown`, so check or cast it.
- `set(key, value)` stores JSON data. A `Date` comes back as its ISO string and an `undefined` field is dropped. It rejects a function, a cycle, or a store over 4 MiB of JSON in total.
- `keys()` resolves every key in insertion order; `delete(key)` removes one.

The store is a JSON file of the plugin's own under the user's Claude Code configuration directory. narsil-pet restores its preferences with `$.store.get(PREFS_KEY)` on `session.start`, and trims old per-session statistics with `$.store.keys()` and `$.store.delete(key)`.

### $.state: values for drawing

`$.state` holds named values for the session. They survive a hot reload of the mod's code, and a `ui.render` hook that reads one is drawn again when it changes, with no call to `$.ui.invalidate`. Each value is declared in the mod's contract (`types/index.d.ts`) under `PluginState`.

The raw calls take a reference whose `plugin` and `key` are literals:

```ts
const ref = { plugin: 'greeter', key: 'calls' } as const

const held = await $.state.get(ref)
await $.state.set(ref, (held.value ?? 0) + 1, { ifVersion: held.version })
```

`get` resolves `{ value, version }` (`undefined` at version 0 when never written). `set` with `ifVersion` writes only while the value stands at that version. Both Narsil mods use the helpers from `claude-code` instead, which do this for you:

```ts
import { atom, read, update } from 'claude-code'

const calls = atom({ plugin: 'greeter', key: 'calls' } as const, 0)

const now = await read($, calls)
await update($, calls, (n) => n + 1)
```

The difference that matters: `$.state` lasts for the session and `$.store` lasts across sessions. To keep a state value after the session ends, write it to `$.store` too. A render hook never writes state (`$.state.set` while drawing is refused); write from a press handler or another event. narsil-pet declares all of its state in `types/index.d.ts` under `PluginState['narsil-pet']` and creates each value with `atom` at the top of `hooks/register.tsx`.

### $.clock: time and timers

```ts
const startedAt = await $.clock.now()
await $.clock.sleep(500)

const once = $.clock.after(10_000, () => $.ui.toast('Ten seconds in'))
const tick = $.clock.every(2000, () => $.ui.status('still here'))
once.cancel()
tick.cancel()
```

`now()` resolves milliseconds since the epoch. `sleep(ms, options?)` waits, and accepts a `signal`. `after(ms, fn)` and `every(ms, fn)` return a timer with `cancel()`. A hot reload cancels pending timers. narsil-pet starts its window with `$.clock.after(10, ...)` and a heartbeat with `$.clock.every(2000, ...)` on `session.start`.

### $.process, $.http, $.env, $.plugin: the host

```ts
const { exitCode, stdout } = await $.process.run(['git', 'status', '--short'], { timeoutMs: 5000 })
const { ok, status, text } = await $.http.fetch('https://example.com/status')
const home = await $.env.get('HOME')
const script = `${$.plugin.root}/scripts/hello.sh`
```

- `process.run(argv, init?)` runs a command by its argument vector, with no shell, and resolves `{ exitCode, stdout, stderr }` for any exit code. `init` takes `cwd`, `env`, `stdin` and `timeoutMs` (30 s by default).
- `http.fetch(url, init?)` goes through the host and resolves `{ status, ok, headers, text }`. `init` takes `method`, `headers`, `body`, `auth` and `socketPath`.
- `env.get(name)` resolves the variable or `undefined`. The name must be a string literal, so validate can list what the module reads.
- `plugin.root` is the plugin's folder (absolute) and `plugin.name` its manifest name. Both are plain strings, not calls.

narsil-check runs package managers and `gh` with `$.process.run` and queries registries and OSV.dev with `$.http.fetch`. narsil-pet reads `OS` with `$.env.get` and builds script paths from `$.plugin.root`.

### $.fs: files

```ts
const path = `${await $.session.cwd()}/notes.json`
if (await $.fs.exists(path)) {
  const notes = JSON.parse(await $.fs.read(path)) as unknown
  await $.fs.write(path, JSON.stringify(notes, null, 2))
}
const entries = await $.fs.list(await $.session.cwd())
```

`read(path)` resolves the text (or bytes with `{ as: 'bytes' }`) and rejects when the file is missing or over 4 MiB. `write(path, text)` creates the file and its directories. `exists(path)` and `list(path?)` do what they say; each `list` entry has `name`, `kind`, `size`, `mtimeMs` and `isLink`. narsil-check's `readJson` helper is `$.fs.exists` followed by `$.fs.read`.

### $.session: the session itself

```ts
const cwd = await $.session.cwd()
const id = await $.session.id()
const usage = await $.session.usage()
const inApp = (await $.session.surfaces()).some((s) => s !== 'terminal')
```

`cwd()` is the directory the session runs in, `id()` its id, `usage()` when it began and how full the context window is, and `surfaces()` every surface it draws on. narsil-pet reads all four; narsil-check reads `cwd()`.

### $.model: completions

```ts
const reply = await $.model.complete({
  model: 'haiku',
  system: 'Answer in one line.',
  prompt: 'Name a color.',
  maxTokens: 50,
})
const color = reply.isAnswered ? reply.text : `no answer: ${reply.reason}`

const forked = await $.model.fork({ prompt: 'Summarize this session in one sentence.' })
```

`complete` runs one completion with no tools and no history and always resolves a result: `isAnswered` with `text`, or `isAnswered: false` with a `reason`. `fork` runs one tool-less completion over the session's own transcript. Both count toward the session's cost. narsil-pet writes its tips with `$.model.complete({ model: 'haiku', ... })` and its deeper tips with `$.model.fork`; narsil-check asks Haiku why an upgrade is risky.

### $.tool and $.command: what the model and the person can call

```tsx
on('session.start', async ($, e, next) => {
  await $.command.register({
    name: 'notes',
    description: 'Show the notes count',
    argumentHint: 'clear',
  })
  await $.tool.register({
    name: 'add_note',
    description: 'Add a note to the list.',
    inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  })
  return next(e)
})

on('command.run', { command: 'notes' }, async ($, e) => {
  const count = Number((await $.store.get('count')) ?? 0)
  return { text: e.args.trim() === 'clear' ? 'Cleared.' : `${count} notes` }
})

on('tool.call', { tool: 'mcp__greeter__add_note' }, async ($, e) => {
  const text = (e as unknown as { text?: unknown }).text
  if (typeof text !== 'string') return { deny: 'A note needs text.' }
  return { result: `Added: ${text}` }
})
```

`command.register` declares `/<name>`; a `command.run` hook on `{ command: '<name>' }` answers it with `{ text }`. `tool.register` declares a tool named `mcp__<plugin>__<name>`; a `tool.call` hook on that name answers it. Both register from `session.start`. This pattern is adapted from narsil-check's `hooks/register.tsx`, which registers its four task-list tools in `registerTools` and answers each with `{ result }` or `{ deny }`.

### $.mcp, $.prompt, $.audio

```ts
const result = await $.mcp.call('example-server', 'list_items', { limit: 5 })
await $.prompt.fill({ text: 'Run the tests again' })
await $.prompt.submit({ text: 'List the files changed today' })
await $.audio.speak('Done')
```

- `mcp.call(server, tool, args?)` calls a tool on a connected MCP server with the engine's own connection and resolves `content` blocks and `isError`. narsil-check reads the desktop app's session servers this way.
- `prompt.fill({ text })` puts text in the prompt box as a draft. narsil-pet uses it when you pick a suggested next step.
- `prompt.submit({ text })` queues a prompt that starts its own turn once the session is idle. narsil-check uses it to hand a task to Claude.
- `audio.speak(text)` speaks with the platform's synthesizer. narsil-pet falls back to it when its own voice script is not available.

## Common mistakes and how to test it

- **Treating `$.state` as permanent.** It ends with the session. Persist through `$.store`.
- **Writing state while drawing.** `$.state.set` inside a `ui.render` hook is refused. Write from `onPress` or another event.
- **Computed state keys or env names.** `plugin` and `key` in a state reference, and the name passed to `$.env.get`, must be literals in the source.
- **Ignoring the result shapes.** `$.model.complete`, `$.ui.notify`, `$.ui.open` and `$.ui.copy` resolve a result that says whether it worked instead of rejecting. Check `isAnswered`, `isSent`, `isPlaced` or `isCopied`.
- **Forgetting that calls can fail.** Both mods wrap optional calls in `.catch(() => undefined)` so one failure does not stop a hook.

`claude plugin validate` lists every `$` call the module makes (`calls: $.state.get, $.ui.toast, ...`), the state keys it reads and writes, and the env names it uses. Type-checking against the declaration file catches a wrong method name or argument before a session loads the mod.

## Going further

- narsil-pet `hooks/register.tsx`: `session.start` uses `$.command.register`, `$.store.get`, `$.env.get`, `$.session.usage`, `$.session.cwd`, `$.clock.after` and `$.clock.every` in one hook.
- narsil-check `hooks/register.tsx`: `registerTools` for `$.tool.register`, the `tool.call` hooks on `mcp__narsil-check__...` that answer them, and `copyRow` for `$.ui.copy`.
- Both `types/index.d.ts` files: the `PluginState` declarations behind every `atom`.
