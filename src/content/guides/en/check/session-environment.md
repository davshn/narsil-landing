---
title: "The session's environment"
description: "How Narsil Check shows the repository, folder, branch, Remote Control and Auto-fix, read from git and the desktop app's servers, and why it asks them so rarely."
route: check
order: 2
updated: 2026-11-17
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

The first section of the pane, **Entorno** ("environment"), shows what the desktop app's session bar shows, so that you can hide that bar and keep one panel. It has one row per fact, and most rows do something when you click them:

| Row                                 | What it shows                                                                            | On a click                                                          |
| ----------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Repositorio** (repository)        | The web address of the `origin` remote, such as `github.com/acme/shop`.                  | Opens it in the browser.                                            |
| **Carpeta** (folder)                | The session's working folder.                                                            | Opens the folder picker and moves the session to the folder picked. |
| **Rama** (branch)                   | The current git branch.                                                                  | Opens a terminal tab in the working folder.                         |
| `worktree …`                        | The session's worktree, when it has one.                                                 | Nothing.                                                            |
| **Control remoto** (Remote Control) | A switch: `●━━ desactivado` in gray, `━━● activado` in green.                            | Turns it on or off.                                                 |
| **Auto-fix**                        | The same switch for the session's open pull request, or `sin PR abierto` ("no open PR"). | Turns it on or off.                                                 |

With a pull request open, a **CI** fold appears between the two switches; the fourth guide of this path covers it.

When something cannot be read, the section says so in red under its row, such as "No pude leer o cambiar el control remoto: …" ("I could not read or change Remote Control: …"), instead of staying empty.

## How it works inside

### Where each fact comes from

The README says the section is read from the desktop app's own MCP servers. The code is more precise, and the difference matters on other surfaces: three facts come from the engine and git, the rest from the app's servers. All of it happens in `loadSession`, in `hooks/register.tsx`.

| Fact                     | Source                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| Folder                   | `$.session.cwd()`                                                                                |
| Branch                   | `$.process.run(['git', 'branch', '--show-current'])`                                             |
| Repository               | `$.process.run(['git', 'remote', 'get-url', 'origin'])`, turned into a web address by `webUrlOf` |
| Remote Control, worktree | `$.mcp.call('ccd_session_mgmt', 'get_session', { session_id: 'self' })`                          |
| Pull request, Auto-fix   | `$.mcp.call('ccd_pr', 'get_status', { session_id: 'self' })`                                     |
| Connectors               | `$.mcp.call('ccd_connectors', 'session_connectors_status')` (next guide)                         |

The server and tool names are constants at the top of `hooks/session.ts` (`SESSIONS_SERVER`, `SESSION_TOOL`, `PR_SERVER`, `PR_TOOL` and the rest), so the hooks module never spells them twice.

`webUrlOf` accepts SSH (`git@github.com:acme/shop.git`, `ssh://git@host:22/acme/shop`) and HTTPS remotes, with or without a user or `.git`, and returns `https://host/owner/repo`. Anything else, a local path among them, gives no link and the row says "sin repositorio remoto" ("no remote repository").

### `$.mcp.call`, as the code uses it

The 2.1.325 types describe `$.mcp.call(server, tool, args)` as a call to a tool "on one of the engine's connected MCP servers with the engine's own connection and credentials". It is positional (server, tool, arguments), not the `mcp__server__tool` name a `tool.call` hook sees. It resolves the result as MCP returns it: `content` blocks, `isError`, and `structuredContent` when the tool declares an output schema.

Narsil Check reads every answer the same way:

```tsx
const result = await $.mcp.call(SESSIONS_SERVER, SESSION_TOOL, { session_id: 'self' })
const read = result.isError
  ? undefined
  : parseSession(result.structuredContent ?? jsonOf(result.content))
where = read ?? { remote: 'unknown', remoteError: textOf(result.content) || 'respuesta sin sesión' }
```

It prefers `structuredContent` and falls back to the JSON inside the text blocks (`jsonOf` in `hooks/session.ts`). Each call is in its own `try`, and a failure becomes an error field of that part only (`remoteError`, `fixError`, `connectorsError`): one server that does not answer does not blank the whole section.

The parsers are defensive on purpose. `parseSession` takes `remoteControlState` when it is one of `on`, `off`, `connecting` or `unavailable`, and otherwise falls back to the boolean `remoteControlActive`. `parsePr` reports Auto-fix only for a pull request that is bound and `open`, because only that one can be switched and the switch needs its url; it also keeps the pull request's repository and head branch for the CI fold.

### Why it asks so rarely

The section could simply ask the servers every few seconds. It does not, and the code and commits give two reasons.

**Each call is visible to every other mod.** A comment in `hooks/register.tsx` says "each call to them reaches every other mod as a tool call". The types agree in their own words: the plugin's call is "seen by the hooks above it". Commit `55fe118` records the consequence: "seven retries tripped Narsil's loop alert". A mod that watches tool calls sees the panel's calls next to Claude's own work; Narsil today skips calls that are not Claude's (`isClaudesCall`, covered in the first guide of path 1), and the comment there names narsil-check reading its session at start as the example.

**An early call can raise a permission prompt.** The comment above `SESSION_DELAY_MS` says the app's servers connect after the session starts, and that "a call that comes while the app has not yet confirmed which server serves the tool makes the app ask the person for permission, whatever the permission mode". Commit `4770a49` "fix: ask the app's session servers once, ten seconds after start" is that fix.

Here the code and the types disagree. The 2.1.325 types say of `$.mcp.call`: "No permission prompt: the plugin's call, seen by the hooks above it, is the grant." The README and the commit describe a prompt the desktop app raised anyway. Treat the types as the engine's contract and the commit as what the author observed in the desktop app, and design for the stricter case.

So the schedule is:

1. **At session start**, `loadSessionAtStart` waits ten seconds with `$.clock.sleep(SESSION_DELAY_MS)` and reads once. It runs with `void`, so the session start is not held up. Until then the section says "Leyendo la sesión…" ("reading the session…").
2. **If that read fails**, it is made again when your first turn starts, "when the servers are surely confirmed", with no quick retries in between. The first read is made with `isFinal: false`: a failed read writes nothing, so the section keeps reading instead of showing an error that the retry may clear.
3. **When each main turn ends**, the folder, branch and repository are read again from git. The servers are asked again only when the turn used a tool that changes their answer (`SESSION_TOOLS`: the `mcp__ccd_session_mgmt__`, `mcp__ccd_connectors__`, `mcp__ccd_directory__` and `mcp__ccd_pr__` tools, `EnterWorktree`, `ExitWorktree`, or a shell command with `gh pr` or `git push`), or when the last read failed.
4. **After a turn that opened or pushed a pull request**, the app may bind it only after the turn ends. `retryPr` asks `ccd_pr` alone again after waits of 5, 10 and 15 seconds (5, 15 and 30 seconds after the turn, as the README puts it), stops as soon as the pull request appears, and stops when the session ends, a `/clear` included.
5. **When you open the Entorno or Conectores fold**, and after you flip a switch, everything is read again.

The shape of this schedule is the point: the cheap reads (git, the folder) happen often, the reads other mods can see happen only when something could have changed.

### The switches

The two switches call the app's servers to change something, then read back:

- **Remote Control**: `$.mcp.call('ccd_session_mgmt', 'set_remote_control', { session_id: 'self', enabled })`. The answer may be JSON or words, so `parseRemote` looks for the state in both.
- **Auto-fix**: `$.mcp.call('ccd_pr', 'set_monitor', { auto_fix: enabled, address_comments: enabled, url })`. A comment says `address_comments` must equal `auto_fix` on the app's side. The README says the app may ask you for permission first.

While a switch changes, `isSwitching` (or `isFixSwitching`) draws the knob in the middle and yellow (`━●━`, "cambiando…"), and the button is not drawn, so a second press cannot race the first. `switchGlyph` and `fixGlyph` in `hooks/session.ts` draw both switches with the same function.

The folder and branch clicks use two more of the app's servers: `ccd_directory` (`request_directory` opens the native picker, `change_directory` moves the session) and `terminal` (`open_terminal_tab`, named after the branch).

### On surfaces without those servers

The terminal, VS Code and the other surfaces do not have the desktop app's servers. There, each `$.mcp.call` fails, and the code turns each failure into its part's error.

What you see follows from the schedule above. The read at ten seconds fails and writes nothing, so the section keeps saying "Leyendo la sesión…". When your first turn starts, the read is made again as final: the repository, folder and branch show (they come from git and the engine), and the Remote Control and Auto-fix rows say in red that they could not be read. The test "a server the mod cannot reach says why once the first turn has tried it too" checks exactly this: two reads in all, each asking every server once, then the error lines.

The README's table of surfaces says Entorno does not work outside the desktop app and that "la sección dice por qué no pudo leerlos" ("the section says why it could not read them"). The code is a little kinder than that: the git rows still show. The clicks on folder and branch need the app's servers, so outside the desktop they answer with a toast saying they could not.

## How it was asked of the AI

The original request for this section was not recorded. None of narsil-check's public task logs (`odd/tasks/*.md`) covers it; they are about ecosystems, release age and vulnerabilities.

### Reconstruction from the commit history

From `git log -- hooks/session.ts`, with the related commits to `hooks/register.tsx`:

- `be8eac0` (2026-11-05) "feat: show the session bar's environment, connectors and Remote Control in the pane". Its message gives the motive: the section is "read from the desktop app's own MCP servers, so the app's session bar can be hidden".
- `2bd1919` (2026-11-05) "feat: repository link, Remote Control switch in Entorno and /mcp from connectors". Entorno drops a Local/Nube ("local/cloud") line and gains the repository link.
- `c07f5e9` (2026-11-05) "feat: Entorno starts open, other sections fold until they have something".
- `d8c664e` (2026-11-05) "fix: retry the first session read until the app's servers answer". The first answer to servers that were not connected yet: retry for about a minute.
- `55fe118` (2026-11-06) "fix: ask the app's session servers less often". At most four reads at start, and servers asked after a turn only when needed, because the retries "tripped Narsil's loop alert".
- `4770a49` (2026-11-06) "fix: ask the app's session servers once, ten seconds after start". The retries are replaced by one delayed read, because of the permission prompt.
- `7d91264` (2026-11-07) "feat: add an Auto-fix switch to Entorno for the session's open pull request".
- `90c40f9` (2026-11-07) "fix: read the session's pull request again when the app binds it after the turn ends".
- `f091e0b` (2026-11-07) "fix: retry only the pull request read and stop the retries when the session ends". Its message: each retry had asked the connectors and the session again, "three calls that reach every other mod".

The pattern is worth noticing: three fixes in a row (`d8c664e`, `55fe118`, `4770a49`) each asked the servers less. The first version tried harder when the servers were not ready; the last one waits, asks once, and asks again only for a reason.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> In my Claude Code mod `my-panel`, add an "Environment" section to the pane. Read the folder with `$.session.cwd()`, the branch with `$.process.run(['git', 'branch', '--show-current'])` and the remote with `git remote get-url origin`, turned into an https link for SSH and HTTPS remotes. Read Remote Control from the desktop app with `$.mcp.call('ccd_session_mgmt', 'get_session', { session_id: 'self' })`, preferring `structuredContent` and falling back to JSON in the text content. Each call to the app's servers is seen by other mods, and an early one may raise a permission prompt, so read once, ten seconds after `session.start` with `$.clock.sleep`, without awaiting it in the hook; if it fails, show "Reading…" and try once more at the first main `turn.start`. After each main turn re-read only git. Keep each part's error separately and show it in red. Test with `mock.clock` that no server is called before ten seconds and only once after.

## The minimal code

This is a reduced version of the idea, written for this guide and checked against the Claude Code 2.1.325 types. It is adapted from `hooks/register.tsx` and `hooks/session.ts` in [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later).

The state's type, in `types/index.d.ts`:

```ts
export type Env = { isLoaded: boolean; cwd: string; branch: string; remote: string; error?: string }

declare module 'claude-code' {
  interface PluginState {
    'my-panel': { env: Env }
  }
}
```

The hooks module, `hooks/register.tsx`:

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'
import type { Env } from '../types'

const PANE = 'my-panel'
const env = atom(
  { plugin: 'my-panel', key: 'env' } as const,
  { isLoaded: false, cwd: '', branch: '', remote: '' } as Env,
)

const git = ($: EngineInterface, argv: string[]) =>
  $.process
    .run(argv, { timeoutMs: 15_000 })
    .then((r) => (r.exitCode === 0 ? r.stdout.trim() : ''))
    .catch(() => '')

// One read; `isFinal: false` writes nothing when the app's server fails.
async function load($: EngineInterface, isFinal: boolean): Promise<boolean> {
  const cwd = await $.session.cwd().catch(() => '')
  const branch = await git($, ['git', 'branch', '--show-current'])
  let remote = 'unknown'
  let error: string | undefined
  try {
    const result = await $.mcp.call('ccd_session_mgmt', 'get_session', { session_id: 'self' })
    const value = (result.structuredContent ?? {}) as { remoteControlState?: unknown }
    if (result.isError || typeof value.remoteControlState !== 'string') error = 'no answer'
    else remote = value.remoteControlState
  } catch (err) {
    error = err instanceof Error ? err.message : String(err)
  }
  if (!error || isFinal)
    await update($, env, () => ({ isLoaded: true, cwd, branch, remote, error }))
  return !error
}

let isRetryPending = false

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    void $.clock
      .sleep(10_000)
      .then(async () => {
        isRetryPending = !(await load($, false))
      })
      .catch(() => undefined)
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined && isRetryPending) {
      isRetryPending = false
      void load($, true).catch(() => undefined)
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const view = await read($, env)
    if (!view.isLoaded) return <Text dimColor>Reading the session…</Text>
    return (
      <Box flexDirection="column">
        <Text>{`Folder ${view.cwd || '?'}`}</Text>
        <Text>{`Branch ${view.branch || 'no git'}`}</Text>
        <Text>{`Remote Control ${view.remote}`}</Text>
        {view.error && (
          <Text color="#F0435A">{`Could not read Remote Control: ${view.error}`}</Text>
        )}
      </Box>
    )
  })
}
```

The pane is opened as in the first guide. Three details carry the design. The delayed read runs with `void`, so `session.start` returns at once. A failed first read writes nothing, so the section says it is reading rather than showing an error that the next try may clear. And the retry waits for a real event, the first turn, instead of a timer loop that other mods would see as repeated tool calls.

## Common mistakes and how to test it

These come from Narsil Check's code and commits:

- **Calling the app's servers right at `session.start`.** They may not be connected yet, and the author saw the desktop app ask for permission even with permissions bypassed (`4770a49`). Wait, then ask once.
- **Retrying in a loop.** Every call is seen by other mods as a tool call; Narsil Check's retries set off Narsil's loop alert (`55fe118`).
- **Awaiting the slow read inside the hook.** `$.clock.sleep` spends the hook's own budget, as the types say. Start it with `void` and let the hook return.
- **Reading only `content`.** Prefer `structuredContent` when the tool declares one, and parse the text blocks only as a fallback.
- **One error for everything.** Keep an error per part, so a missing server does not hide the branch you can read from git.
- **Assuming every surface has the desktop servers.** On the terminal the calls fail; design the section to show what git can tell and to say why the rest is missing.
- **Reading the servers after every turn.** Narsil Check asks them again only when the turn used a tool that changes their answer (`SESSION_TOOLS`) or the last read failed.

To test, `tests/session.test.tsx` in narsil-check answers the app's servers with an `on('mcp.call', ...)` hook, git with `on('process.run', ...)` and the folder with `on('session.cwd', ...)`, and moves time with `mock.clock(on)` and `clock.advance`. Tests worth copying by name include "the app's servers are first asked ten seconds after the session starts, once; a failed read is tried again as the first turn starts", "a turn that touched no session tool reads only git again, not the app's servers" and "a server the mod cannot reach says why once the first turn has tried it too". Use synthetic values in your fixtures, such as a remote `git@github.com:acme/shop.git`.

## Going further

The full section in narsil-check adds:

- The **CI** fold of the session's pull request, read with `gh` (the fourth guide).
- The **Conectores** section, read from the same servers in the same `loadSession` (the next guide).
- `pathOf` in `hooks/session.ts`, which finds the folder the picker answered with, as a `path` field or as the first absolute path in its words.
- The same section is what lets you hide the desktop app's own session bar: everything it showed is here, with the same clicks.
