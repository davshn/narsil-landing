---
title: What a mod is made of
description: The three files of a Claude Code mod, the register function and its hooks, and the smallest mod that shows something on screen.
route: mods
order: 1
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: .claude-plugin/plugin.json
  - repo: pet
    path: hooks/hooks.json
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: types/index.d.ts
---

## What it does

A mod is a Claude Code plugin of function hooks: TypeScript that runs inside Claude Code and changes what it shows or how it behaves. By the end of this guide you will know which files a mod needs, what the `register` function does, and you will have a mod that shows a toast when a session starts and keeps a tool-call count in its status line.

The mod API is early access and changes between releases. Everything here was checked against Claude Code 2.1.325 and its declaration file, `claude-code.d.ts`. When your build is newer, that file is the authority.

## How it works inside

A mod is a folder with three files you write by hand:

| File                         | What it holds                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `.claude-plugin/plugin.json` | The manifest: `name`, `version`, `description`, and optionally `license`, `repository` and `types`.          |
| `hooks/hooks.json`           | One line naming the hooks module: `{ "modules": ["./register.tsx"] }`. The path is relative to `hooks.json`. |
| `hooks/register.tsx`         | The hooks module. It exports `register`.                                                                     |

The hooks module is an ES module named `.ts`, `.tsx`, `.js` or another script suffix. It runs in an environment of its own, with no DOM and no Node. Everything outside the module (the screen, files, the network, the clock) is reached through the `$` object that every hook receives. Other files of the plugin are imported with ordinary `import` declarations; a module that uses dynamic `import()` does not load.

`register(on, options)` is called when the module loads. `on(event, matcher?, hook)` adds a hook to an event. `options` holds the values of any `userConfig` fields the manifest declares.

Every hook has the shape `($, e, next)`:

- `$` is the engine interface: display, store, state, clock, network, processes, files, session, model, tools, commands and the rest.
- `e` is the event's input as a plain value. For `tool.call` it is the tool call, narrowed per tool.
- `next(e)` passes the event on to the other plugins and then to Claude Code's own behaviour, and resolves to the event's result.

A hook that returns without calling `next` answers the event itself. A hook that calls `next({ ...e, ... })` changes what the rest of the chain sees, within what that event allows. Most hooks that only observe end with `return next(e)`.

The optional `types/index.d.ts` file is the mod's type contract. It declares the shape of the values the mod keeps in `$.state` (and, for a mod that adds a noun to `$`, that noun). `plugin.json` names it under `"types"`, and `claude plugin validate` checks the mod's state reads and writes against it.

## Step by step

### 1. The manifest

Create a folder called `greeter` and write `.claude-plugin/plugin.json`:

```json
{
  "name": "greeter",
  "version": "0.1.0",
  "description": "Says hello when a session starts and counts tool calls"
}
```

The `name` is how Claude Code, its debug log and your state keys refer to the mod.

### 2. The hooks file

Write `hooks/hooks.json`:

```json
{ "modules": ["./register.tsx"] }
```

### 3. A hook that shows something

Write `hooks/register.tsx` with one hook on `session.start`:

```tsx
import type { Register } from 'claude-code'

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    $.ui.toast('Hello from greeter')
    return next(e)
  })
}
```

`Register` comes from the `claude-code` module. The import is for types only: at run time it is empty. `$.ui.toast(text)` shows a small box under the plugin's name for a few seconds (4000 ms by default). The hook then calls `next(e)` so the session starts as usual.

### 4. A status line that counts tool calls

Add a second hook. `tool.call` runs for every tool call, and `$.ui.status(text)` pins one line for this plugin under the prompt until the next call replaces it:

```tsx
import type { Register } from 'claude-code'

export const register: Register = (on) => {
  let count = 0

  on('session.start', async ($, e, next) => {
    $.ui.toast('Hello from greeter')
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    count += 1
    $.ui.status(`greeter: ${count} tool calls`)
    return next(e)
  })
}
```

This works, but `count` is a module variable. Saving the file reloads the module in a fresh environment, so the count starts over.

### 5. A type contract and state that survives a reload

`$.state` holds named values for the session, and they survive a hot reload of the module. Declare the value in `types/index.d.ts`:

```ts
declare module 'claude-code' {
  interface PluginState {
    greeter: { calls: number }
  }
}
```

Name the file in the manifest:

```json
{
  "name": "greeter",
  "version": "0.1.0",
  "description": "Says hello when a session starts and counts tool calls",
  "types": "./types/index.d.ts"
}
```

Then use the state helpers `atom` and `update` from `claude-code`:

```tsx
import { atom, update } from 'claude-code'
import type { Register } from 'claude-code'

const calls = atom({ plugin: 'greeter', key: 'calls' } as const, 0)

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    $.ui.toast('Hello from greeter')
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const count = await update($, calls, (n) => n + 1)
    $.ui.status(`greeter: ${count} tool calls`)
    return next(e)
  })
}
```

`plugin` and `key` must be string literals, matching the contract. `update` reads the value, applies the function and writes it back, retrying if another write landed first, and resolves to the new value.

The finished mod:

```text
greeter/
  .claude-plugin/plugin.json
  hooks/hooks.json
  hooks/register.tsx
  types/index.d.ts
```

The guide "Install, reload, validate, and test" shows how to load it in a session.

## Common mistakes and how to test it

- **Forgetting `next`.** A hook that never calls `next(e)` answers the event alone. On `session.start` or `tool.call` that changes more than you intended. Return `next(e)` unless answering is the point.
- **Registering the same hook twice.** A repeated registration throws, and a loop that runs one `on(...)` twice passes validate but is refused at load.
- **Using Node or DOM APIs.** There is no `require`, no `fs` module and no `window`. Use `$.fs`, `$.http`, `$.process` and the rest of `$`.
- **A hook that throws.** It is skipped and the chain goes on without it. Run with `claude --debug` while developing: the debug log says why a hook was skipped.

Run `claude plugin validate` on the folder early and often. It reads the manifest, the contract and the hooks module the way Claude Code will. For the finished `greeter` it reports, among other lines:

```text
❯ types ./types/index.d.ts declares state: greeter.calls
❯ ./register.tsx hooks: session.start, tool.call
❯ ./register.tsx gating hook without .catch: tool.call
❯ ./register.tsx calls: $.state.get, $.state.set, $.ui.status, $.ui.toast
```

The `gating hook without .catch` line is a fact, not a failure: `tool.call` is an event whose answer can refuse what was asked, and a hook there that fails is skipped. Only a hook that guards (one that may refuse a call) needs a `.catch` handler.

## Going further

narsil-pet follows the same layout. Its `.claude-plugin/plugin.json` sets `"license": "GPL-3.0-or-later"`, `repository` and `"types": "./types/index.d.ts"`. Its `hooks/hooks.json` is the same one line as above. Its `hooks/register.tsx` exports `register` and registers one hook per event, starting with `session.start`, which registers the `/narsil` command, restores preferences from `$.store` and starts its timers before returning `next(e)`. Its `types/index.d.ts` exports the mod's types (`Mood`, `Pet`, `Prefs` and others) and declares every `$.state` key under `PluginState['narsil-pet']`.
