---
title: Install, reload, validate, and test
description: Load a mod from its folder or a local marketplace, reload it after an edit, and check it with claude plugin validate, claude plugin test, and tsc.
route: mods
order: 3
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: .claude-plugin/marketplace.json
  - repo: pet
    path: README.md
  - repo: check
    path: .claude-plugin/marketplace.json
  - repo: check
    path: tsconfig.json
  - repo: check
    path: tests/pane.test.tsx
  - repo: check
    path: README.md
---

## What it does

This guide takes the `greeter` mod from "What a mod is made of" and runs it in a session, reloads it after a change, and checks it three ways: `claude plugin validate` for what the engine will see, `claude plugin test` for what the hooks do, and `tsc` for the types.

## How it works inside

Claude Code reads a mod from one of two kinds of place, and that decides how an edit reaches a running session:

| How it is loaded                                                               | How an edit arrives                                                                                                                          |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `claude --plugin-dir <folder>`, or a folder named in `CLAUDE_CODE_PLUGIN_DIRS` | In an interactive session the folder is watched: saving a file reloads the hooks module.                                                     |
| Installed from a marketplace that is a local folder, with a relative `source`  | Run `/reload-plugins`. The session re-reads the folder itself, with no new version and no reinstall.                                         |
| Installed from a git repository, npm, an archive or a URL                      | The session runs the copy made at install. An edit arrives only as a new version, through `claude plugin update` and then `/reload-plugins`. |

A reload runs `register` again in a fresh environment. Module variables and pending timers are gone; values in `$.state` and `$.store` remain.

## Step by step

### 1. Run it from its folder

For one session:

```bash
claude --plugin-dir ./greeter
```

Repeat the flag to load several folders. Where no flag can be given (a session the desktop app or an SDK host starts), set `CLAUDE_CODE_PLUGIN_DIRS` to one or more absolute paths (`~` is allowed), separated by the platform's path-list separator. It is read from the process environment or from the `env` block of `~/.claude/settings.json`, never from a project's settings.

In an interactive session the folder is watched. A save reloads the module once the folder has been quiet for a moment; saves made while a turn runs reload once, when the turn ends. Run with `claude --debug` while developing: when a hook is skipped or a module does not load, the transcript says so once, and the debug log has every occurrence.

### 2. Make the folder a local marketplace

A marketplace is one file, `.claude-plugin/marketplace.json`, beside `plugin.json`. Its one entry points at the folder itself:

```json
{
  "name": "greeter-dev",
  "owner": { "name": "Example Author" },
  "plugins": [{ "name": "greeter", "source": "./" }]
}
```

Add the folder as a marketplace and install the mod from it:

```bash
claude plugin marketplace add ./greeter
claude plugin install greeter@greeter-dev
```

At the prompt of a terminal session the install line also has the form `/plugin install <mod> --marketplace <source>`, where the source is a GitHub `<owner>/<repo>`, a git URL or a folder's path. `claude plugin list` shows the folder a plugin is read from (`Read from:`).

Because the entry's `source` is a relative path, the session reads the mod from that folder, not from a copy. After an edit, run:

```text
/reload-plugins
```

The reload names the plugin and the folder when the folder changed since the session last read it.

### 3. Validate

```bash
claude plugin validate ./greeter
```

It reads the marketplace file, the manifest, the type contract and the hooks module's source the way the engine will, and reports what the module hooks and calls and everything the engine would refuse, before a session loads it. For `greeter` the hooks section reads:

```text
❯ ./register.tsx hooks: session.start, tool.call
❯ ./register.tsx gating hook without .catch: tool.call
❯ ./register.tsx calls: $.state.get, $.state.set, $.ui.status, $.ui.toast
❯ ./register.tsx state writes: greeter.calls
❯ ./register.tsx state reads: greeter.calls
```

The same run also lists the checks the public plugin directory applies (a README of at least 40 words, a `LICENSE` file or a `license` in `plugin.json`, an icon). Those matter for a submission, not for running the mod.

Validate knows the mod, not a session: whether a hook actually ran is checked in the session, with `claude --debug`.

### 4. Test

`claude plugin test <folder>` runs the plugin's `*.test.ts` and `*.test.tsx` files against the engine itself. A test imports `test` and `expect` (and `mock`) from `claude-code/testing` and receives the engine's `$` and an `on` whose hooks sit beneath the plugin, standing in for the engine. Nothing else sits beneath them, so the test answers what the plugin calls: a call on `$` with `{ value }`, an event with its own result.

Write `tests/greeter.test.tsx`:

```tsx
import { expect, test } from 'claude-code/testing'

test('greets on start and counts tool calls', async ($, on) => {
  const toasts: string[] = []
  const lines: (string | undefined)[] = []

  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.status', (_, e) => {
    lines.push(e.text)
    return { value: undefined }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await $.tool.call({ tool: 'Bash', command: 'pwd' })

  expect(toasts).toEqual(['Hello from greeter'])
  expect(lines.at(-1)).toBe('greeter: 2 tool calls')
})
```

Run it:

```bash
claude plugin test ./greeter
```

```text
(pass) greets on start and counts tool calls
 1 pass
 0 fail
```

A UI test mounts a component through the plugin on a surface it names (`$.ui.mount({ plugin, surface, component, props })`) and acts on the drawing by key: `find`, `press`, `input`. Write the body once and loop it over the surfaces, so the test shows the mod does not depend on one of them. The skill's `pane.test.tsx` example mounts a `Pane` on `terminal`, `desktop`, `vscode` and `mobile` in one loop.

### 5. Type-check

When Claude Code loads a mod from a folder it is being written in (a `--plugin-dir` or `CLAUDE_CODE_PLUGIN_DIRS` folder the session hot-reloads), it lays the API's declarations beside it in `.claude-plugin/types/`, with a `tsconfig.json`. A mod's own `tsconfig.json` extends it:

```json
{
  "extends": "./.claude-plugin/types/tsconfig.json"
}
```

Then:

```bash
npx tsc -p ./greeter
```

`.claude-plugin/types/` is regenerated at every load, so keep it out of git. Both Narsil mods list it in `.gitignore`.

A folder the session does not hot-reload (an installed plugin's, or a `--plugin-dir` under `claude -p`) never gets those files. Type-check such a mod with the `tsconfig.json` printed in the header of `claude-code.d.ts`, kept outside the mod folder, with its `include` pointing at a copy of the declaration file and at the mod's `hooks`, `types` and `tests`.

## Common mistakes and how to test it

- **Editing a copy the session does not run.** A mod installed from a git repository runs the installed copy. Install from a local folder marketplace, or load the folder with `--plugin-dir`, while you develop.
- **A test hook that returns nothing.** In `claude plugin test`, a hook that stands for the engine must answer. A `$` call answered with nothing fails with "returned no result" and "nothing beneath the plugins answers ui.toast".
- **Testing one surface only.** Loop UI tests over the surfaces you support; mobile apps may not draw `Input` or `Select`.
- **Committing `.claude-plugin/types/`.** It belongs to the build that wrote it. Regenerate it, never edit it.
- **Expecting validate to run the code.** It reads the source. Behaviour is what `claude plugin test` and a `--debug` session show.

## Going further

Both Narsil mods ship a marketplace file listing the mod with `"source": "./"`: narsil-pet's `.claude-plugin/marketplace.json` names the marketplace `narsil`, and narsil-check's names it `narsil-check`. Their READMEs install with two lines at the Claude Code prompt:

```text
/plugin marketplace add davshn/narsil-pet
/plugin install narsil-pet@narsil
```

and update with `/plugin marketplace update` followed by `/plugin update`. narsil-check's README describes the local workflow from this guide: add your copy's folder with `claude plugin marketplace add`, and changes arrive with `/reload-plugins`, without reinstalling. Its `tsconfig.json` is the one-line `extends` above, and its `tests/` folder holds one `*.test.tsx` per feature; `tests/pane.test.tsx` mounts the pane with a `PANE` constant the same way the skill's example does.
