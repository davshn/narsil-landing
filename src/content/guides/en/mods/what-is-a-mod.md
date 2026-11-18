---
title: What a mod is made of
description: The three files of a Claude Code mod, the register function and its hooks, and the smallest mod that shows something on screen.
route: mods
order: 1
updated: 2026-11-18
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

A mod is a Claude Code plugin made of hooks. A hook is a function that Claude Code calls when something happens: a session starts, Claude calls a tool, a turn ends. Mods are written in TypeScript and change what Claude Code shows or how it behaves.

In this guide you will ask Claude to build a small mod called `greeter`. It shows a short message (a toast) when a session starts and counts tool calls in its status line. Along the way you will learn which files every mod needs and what the `register` function does, so you can tell whether what Claude wrote is right.

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

## Build it with Claude

You do not need to type these files yourself. Claude Code includes a skill for writing mods, `plugin-authoring`, which knows the real types of the mod API. Ask Claude to use it, and describe what you want in plain words: the mod's name, what it does, and when.

> Using the plugin-authoring skill, create a Claude Code mod called `greeter` in a new folder. When a session starts, it shows a toast that says "Hello from greeter". It counts every tool call and shows the count in its status line, for example "greeter: 3 tool calls". Keep the count in `$.state` with an `atom` declared in `types/index.d.ts`, so it survives a reload of the module. When you finish, run `claude plugin validate` on the folder and show me what it reports.

Why this prompt works:

- **It names the skill**, so Claude checks each call against the real API instead of guessing.
- **It describes behavior you can see** (the toast and the status line), so you can tell when it works.
- **It says where the count lives.** Without that line, a common first answer keeps the count in a plain variable that resets every time you save the file. Step 4 below shows why.
- **It asks for proof.** The validate output lists the hooks and calls the mod really makes.

When Claude answers, check four things before you go on:

1. The folder has the four files from the table above: `plugin.json`, `hooks.json`, `register.tsx` and `types/index.d.ts`.
2. Every hook ends with `return next(e)`.
3. The count uses `atom` and `update`, not a variable declared with `let`.
4. `claude plugin validate` lists `hooks: session.start, tool.call`.

If something is off, tell Claude what you see, not only how to fix it: "the count goes back to 0 every time I save `register.tsx`". Describing the symptom lets Claude find the cause, and you learn to read the mod the way it does.

## Understand the code, step by step

This is what a good answer looks like, built one piece at a time. Read it to understand what each line does and to compare it with what Claude wrote. Claude may choose other names or another order and still be right.

### 1. The manifest

The mod lives in a folder called `greeter`. Its manifest is `.claude-plugin/plugin.json`:

```json
{
  "name": "greeter",
  "version": "0.1.0",
  "description": "Says hello when a session starts and counts tool calls"
}
```

The `name` is how Claude Code, its debug log and your state keys refer to the mod.

### 2. The hooks file

`hooks/hooks.json` tells Claude Code which file holds the hooks:

```json
{ "modules": ["./register.tsx"] }
```

### 3. A hook that shows something

`hooks/register.tsx` starts with one hook on `session.start`:

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

A second hook counts the calls. `tool.call` runs for every tool call, and `$.ui.status(text)` pins one line for this plugin under the prompt until the next call replaces it:

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

This is a common first answer, and a good example of why you check: it works until you save the file. `count` is a module variable, and saving reloads the module in a fresh environment, so the count starts over at 0.

### 5. A type contract and state that survives a reload

The fix is `$.state`, which holds named values for the session and keeps them when the module reloads. The value is declared in `types/index.d.ts`:

```ts
declare module 'claude-code' {
  interface PluginState {
    greeter: { calls: number }
  }
}
```

The manifest names that file:

```json
{
  "name": "greeter",
  "version": "0.1.0",
  "description": "Says hello when a session starts and counts tool calls",
  "types": "./types/index.d.ts"
}
```

And the hook uses the state helpers `atom` and `update` from `claude-code`:

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

The next guide, "Install, reload, validate, and test", shows how to load it in a session and test it.

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
