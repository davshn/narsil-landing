---
title: Connectors
description: "How Narsil Check lists the session's MCP servers with their state and how many tools each has, asked once from the desktop app's own connectors server."
route: check
order: 4
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/session.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: types/index.d.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/session.test.tsx
---

## What it does

The **Conectores** ("connectors") section lists the MCP servers of the session, the same list the desktop app's session bar shows. It answers two quick questions: which servers can Claude use right now, and which one needs you.

The head reads `▸ Conectores · 2`, where the number counts the servers that are connected. Unfolded, it shows:

- **The connected servers first**, each with a green dot and how many tools it offers, such as `notes-server · 19 herramientas` ("19 tools").
- **Then the rest**, each with a yellow dot and its state as the app reports it, such as `Mail · needs_auth`.

When nothing is connected it says "No hay conectores conectados." ("no connectors are connected"). When the list cannot be read, it says why in red: "No pude leer los conectores: …" ("I could not read the connectors: …").

The section's dot sums it up: green when every server is up, yellow when one needs a sign-in or failed, red when the list could not be read, gray before the first read.

Every session starts with this section folded; the session start sets it so (`isConnectorsOpen` to `false`) whatever you left it as.

## How it works inside

### Where the list comes from

The list is one call to the desktop app's own connectors server, made in `loadSession` in `hooks/register.tsx`, next to the session reads of the previous guide:

```tsx
const result = await $.mcp.call(CONNECTORS_SERVER, CONNECTORS_TOOL)
const list = result.isError
  ? undefined
  : parseConnectors(result.structuredContent ?? jsonOf(result.content))
connectors = list
  ? { connectors: list }
  : { connectors: [], connectorsError: textOf(result.content) || 'respuesta sin conectores' }
```

`CONNECTORS_SERVER` is `'ccd_connectors'` and `CONNECTORS_TOOL` is `'session_connectors_status'`, both in `hooks/session.ts`. The call takes no arguments. As with every `$.mcp.call` (see the previous guide), the answer is read from `structuredContent` when there is one and from the JSON in the text blocks otherwise, and a failure is caught and kept as `connectorsError`.

`parseConnectors` turns the answer into the mod's own type, `Connector` in `types/index.d.ts`: `{ name, status, tools? }`. It reads a `servers` array; drops any entry without a string `name`; keeps `status` as text, or `'unknown'` when it is missing; and keeps `tool_count` as `tools` only when it is a number. If there is no `servers` array at all, it returns `undefined`, which the caller turns into an error rather than an empty list.

That distinction is deliberate: "no servers are connected" and "I could not read the servers" are different answers, and the section shows them differently.

### What it shows, and what it does not

The section shows each server's name, state and tool count. It does not list the names of the tools. The README describes the same: the connected servers "con cuántas herramientas tiene cada uno" ("with how many tools each one has"), then the others with their state.

The fields it reads (`servers`, `name`, `status`, `tool_count`) are the desktop app's server answer, not part of the mod API, so the 2.1.325 types do not document them. The fixture in `tests/session.test.tsx` shows the shape the author worked with, with a `kind` field the mod ignores. The parser accepts what it does not know: a status other than `connected` is shown as it came, and the yellow dot of a row means only "not connected".

The words are pure functions in `hooks/session.ts`, so they can be tested alone:

- `connected(view)` filters the servers whose status is `connected`.
- `connectorsLabel(isOpen, view)` draws the head, with the count only when it is above zero.
- `connectorLine(c)` draws a row: the name, then the tool count for a connected server, else the state.
- `toolsLabel(n)` says `1 herramienta` or `N herramientas`.
- `connectorsColor(view)` picks the dot, checking the error first, then whether the list was read, then whether any server is `needs_auth` or `failed`.

### When it is read again

The connectors are read in the same `loadSession` as the rest of the session, so they follow the same careful schedule: once ten seconds after the session starts, once more at the first turn if that failed, and after a turn only when the turn used a tool that changes the servers' answer. For connectors that means any `mcp__ccd_connectors__` tool, which is part of `SESSION_TOOLS`. Opening the fold reads everything again, so unfolding the section is how you refresh it by hand.

The reason is the same as for the environment: each call to the app's servers is seen by every other mod as a tool call, and an early one may make the desktop app ask for permission.

### Why a desktop server, and not the engine

The 2.1.325 types give the mod two calls on `$.mcp`: `call`, to call a connected server's tool, and `connect`, to bring a held server into the session. Neither lists the servers with their states. The desktop app has a tool that does, so Narsil Check asks it.

The cost is the surface. Outside the desktop app there is no `ccd_connectors`, the call fails, and the section says so. The README's table of surfaces states it: Conectores works in the desktop app, and elsewhere "la sección dice por qué no pudo leerlos" ("the section says why it could not read them").

### What the section is for

The commits show the section's purpose changing once. In `2bd1919` a click on any connector row opened `/mcp`, the engine's own server list. One commit later, `c07f5e9` made the rows plain again, and its message says why: "/mcp from a mod only prints a summary in the desktop app". So the section is for reading at a glance, and the place to sign in or fix a server stays the app's own.

## Build it with Claude

Ask Claude for a section that lists the session's MCP servers and their state. The one idea it must get right is that "no servers are connected" and "I could not read the servers" are different answers, and the section shows them differently.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> In my Claude Code mod `my-panel`, add a "Connectors" section to the pane. In the desktop app, read the session's MCP servers once with `$.mcp.call('ccd_connectors', 'session_connectors_status')`, preferring `structuredContent` and falling back to the JSON in the text content. Parse a `servers` array into `{ name, status, tools }` from `name`, `status` and `tool_count`, dropping entries without a name, and treat a missing array as an error, not as an empty list. Show the connected servers first with a green dot and their tool count, then the others with a yellow dot and their status. Color the section's dot red when the read failed, gray before it, yellow when a server is `needs_auth` or `failed`, and green otherwise. Re-read only when the fold opens. Test the parser and the colors as pure functions.

### What to check in Claude's answer

1. The list comes from one `$.mcp.call('ccd_connectors', 'session_connectors_status')`, read from `structuredContent` first and from the JSON in the text content otherwise.
2. The parser drops entries without a string `name`, keeps an unknown `status` as text, and returns `undefined`, not an empty list, when there is no `servers` array.
3. The section's dot is red when the read failed, gray before the first read, yellow when a server is `needs_auth` or `failed`, and green otherwise.
4. Connected servers come first with a green dot and their tool count, then the others with a yellow dot and their state.
5. The list is not read on a timer. Opening the fold reads it again.

If a check fails, tell Claude what you see: "outside the desktop app the section says no connectors are connected, instead of saying why it could not read them".

### How the author asked for it

The original request for the connectors section was not recorded. None of narsil-check's public task logs (`odd/tasks/*.md`) covers it.

#### Reconstruction from the commit history

From `git log -- hooks/session.ts`, with the related commits to `hooks/register.tsx`:

- `be8eac0` (2026-11-05) "feat: show the session bar's environment, connectors and Remote Control in the pane". The connectors arrive together with the environment, as part of replacing the app's session bar.
- `2bd1919` (2026-11-05) "feat: repository link, Remote Control switch in Entorno and /mcp from connectors". Its message: "Any connector row opens /mcp."
- `c07f5e9` (2026-11-05) "feat: Entorno starts open, other sections fold until they have something". Conectores starts folded, and the rows are plain again.
- `55fe118` (2026-11-06) and `4770a49` (2026-11-06), the two fixes that made every read of the app's servers rarer, covered in the previous guide. They apply to the connectors because they are read in the same call.

The pattern: one feature added with the rest of the session bar, a click that turned out not to help in the desktop app and was removed, and the rule about asking rarely, inherited from the environment.

## Reference code

This is one correct answer, written for this guide. Read it to understand how the pieces fit together and to compare it with what Claude wrote for you: Claude may choose other names or another order and still be right.

This is a reduced version of the idea, written for this guide and checked against the Claude Code 2.1.325 types. It is adapted from `hooks/session.ts` and `hooks/register.tsx` in [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later).

The pure part, `hooks/connectors.ts`:

```ts
export type Connector = { name: string; status: string; tools?: number }

export function parseConnectors(value: unknown): Connector[] | undefined {
  const servers = (value as { servers?: unknown } | undefined)?.servers
  if (!Array.isArray(servers)) return undefined
  return servers
    .filter(
      (s): s is Record<string, unknown> =>
        typeof s === 'object' && s !== null && typeof s.name === 'string',
    )
    .map((s) => ({
      name: s.name as string,
      status: typeof s.status === 'string' ? s.status : 'unknown',
      ...(typeof s.tool_count === 'number' ? { tools: s.tool_count } : {}),
    }))
}

export function connectorLine(c: Connector): string {
  if (c.status !== 'connected') return `${c.name} · ${c.status}`
  return c.tools === undefined ? c.name : `${c.name} · ${c.tools} tools`
}
```

The call, in `hooks/register.tsx`, returning either the list or the reason it could not be read:

```tsx
import type { EngineInterface } from 'claude-code'
import { parseConnectors, type Connector } from './connectors'

async function readConnectors($: EngineInterface): Promise<{ list: Connector[]; error?: string }> {
  try {
    const result = await $.mcp.call('ccd_connectors', 'session_connectors_status')
    const list = result.isError ? undefined : parseConnectors(result.structuredContent)
    return list ? { list } : { list: [], error: 'no list in the answer' }
  } catch (err) {
    return { list: [], error: err instanceof Error ? err.message : String(err) }
  }
}
```

Keep the result in an atom and draw it in the pane's `ui.render` hook as in the first guide: connected rows first, then the rest, each with `connectorLine`. This minimal version reads only `structuredContent`; Narsil Check also parses the JSON in the text blocks (`jsonOf` in `hooks/session.ts`), in case the server answers only with text.

## Common mistakes and how to test it

These come from Narsil Check's code and commits:

- **Treating a failed read as "no servers".** Return `undefined` from the parser when the shape is wrong, and show the error. "No connectors" is a real answer that should only come from a real list.
- **Trusting the app's answer shape.** These fields are the desktop app's, not the mod API's. Check each field's type, as `parseConnectors` does, and show an unknown status as text.
- **Refreshing on a timer.** Each call is a tool call other mods see. Read on events: the start, a turn that touched the connectors, the fold opening.
- **Linking rows to `/mcp`.** Narsil Check tried it and removed it (`c07f5e9`): from a mod, in the desktop app, it only prints a summary.
- **Expecting it on every surface.** `ccd_connectors` is the desktop app's; elsewhere the section can only say why it is empty.

To test, the parsers and labels are pure: `tests/session.test.tsx` checks them directly in "the session section reads the app servers and names what it found". For the section itself, answer the server with a hook such as `on('mcp.call', (_, e) => e.server === 'ccd_connectors' ? { value: { content: [{ type: 'text', text: JSON.stringify({ servers: [...] }) }], isError: false } } : ...)`, mount the pane, press `section-connectors` and look for the rows. Use synthetic server names in fixtures, such as `notes-server` and `Mail`.

## Going further

- The section pairs with the environment of the previous guide: both are read in one `loadSession`, so one schedule governs every call to the app's servers.
- The types offer another source that works on every surface: `$.tool.list()` returns the tools the model can call now, each with `name`, `description` and `mcp: true` for an MCP server's tool. Grouping the `mcp__server__tool` names by server gives the connected servers and their tools, by name. It does not say which servers wait on a sign-in or failed, which is what the yellow rows here are for. That is a real tradeoff, and narsil-check chose the desktop server.
- `$.mcp.connect(server)` can bring in a server the session held back, which is the step after seeing a server that is not connected. Narsil Check does not use it.
