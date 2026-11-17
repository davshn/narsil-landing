---
title: 'Surfaces: terminal, desktop, VS Code, and mobile'
description: Where a mod draws, which elements each surface has, and how to write one render hook that works on the terminal, the desktop app, VS Code, and the mobile app.
route: mods
order: 4
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: README.md
  - repo: pet
    path: hooks/register.tsx
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: README.md
---

## What it does

The same mod can draw in the terminal, in the Claude desktop app, in VS Code and in the Claude mobile app. Each of these is a surface, and each has its own set of elements. This guide explains how a render hook learns which surface it draws on, what each surface offers, and how to write one tree that holds up on all of them.

## How it works inside

A mod draws by hooking `ui.render` for a component. The hook receives one component instance in `e`:

- `e.component`: which site is drawn (`AbovePrompt`, `Pane`, `ToolUse` and others).
- `e.surface`: where it is drawn: `terminal`, `desktop`, `mobile` or `vscode`.
- `e.props`: the site's own props, as plain data.
- `e.viewport`: when the surface has measured, the size it draws into in character cells.

A session can draw on several surfaces at once, for example a terminal and two phones. `$.session.surfaces()` lists every surface the session draws on, the terminal first. A render hook does not need that list: it is asked once per surface, and reads `e.surface` each time.

The elements are not globals. `$.ui.resolve(e)` returns the table for the surface `e` is drawn on, and the hook destructures its JSX tags from it. Narrowing `e.surface` narrows the table's type.

| Surface    | Elements                                                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `terminal` | `Box`, `Text`, `Button`, `Input`, `Select`, `Link`, `Code`, `Markdown`, `Progress`, plus `Client`, `Raster` and `Image`. No `Svg`. |
| `desktop`  | The nine shared elements, plus `Svg` and `Client`.                                                                                 |
| `vscode`   | The desktop's table without `Client`.                                                                                              |
| `mobile`   | The nine shared elements, plus `Svg`. No `Client`.                                                                                 |

On mobile, an app receives an `Input` or a `Select` only if it said it draws them, and an empty `Box` otherwise; a `Progress` the same way, falling back to its `Box` and `Text`. A hook cannot tell which the app got.

Where each site is drawn, as the declaration file states it:

| Site                                      | Raised on                         | Notes                                                                                                                                                     |
| ----------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AbovePrompt` (the band above the prompt) | terminal, desktop and mobile only | One row per plugin. The person can collapse or focus it.                                                                                                  |
| `Pane` (opened with `$.ui.open`)          | every attached surface            | Docked in the terminal's fullscreen layout, else above the prompt. On the desktop app it can also be a small `widget`, read from `e.props.placement`.     |
| `ToolUse` (a tool call's row)             | every attached surface            | On mobile, a tree that keeps the row usually draws as one quiet line under it; a `borderStyle` or `backgroundColor` on the holding `Box` asks for a card. |

Two outputs do not go through `ui.render`. `$.ui.status(text)` pins a line for the plugin under the prompt. `$.ui.toast(text)` floats over the transcript's top right corner, and where the transcript is printed into scrollback it is one line on the notification bar. The declaration file does not list surface by surface where these two appear.

## Step by step

### 1. A band that reads its surface

```tsx
import { atom, read } from 'claude-code'
import type { Register } from 'claude-code'

const calls = atom({ plugin: 'greeter', key: 'calls' } as const, 0)

export const register: Register = (on) => {
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const count = await read($, calls)
    const where = e.surface === 'terminal' ? 'in the terminal' : `on ${e.surface}`

    return (
      <Box>
        <Text dimColor>
          {count} tool calls {where}
        </Text>
      </Box>
    )
  })
}
```

`Box` and `Text` are in every table, so this tree draws wherever the band is raised. The hook yields to a survey (`e.props.hasSurvey`) by returning `next(e)`.

### 2. Use an element only where the surface has it

When a tree needs an element that some surfaces lack, check the table instead of assuming. This is adapted from the `Pane` hook in narsil-check's `hooks/register.tsx`, which shows an SVG only where there is `Svg` and a text field everywhere but mobile:

```tsx
on('ui.render', { component: 'Pane', requestId: 'notes' }, async ($, e) => {
  const elements = $.ui.resolve(e)
  const { Box, Text } = elements
  const Input = e.surface !== 'mobile' && 'Input' in elements ? elements.Input : undefined

  return (
    <Box flexDirection="column">
      <Text bold>Notes</Text>
      {Input ? (
        <Input key="new" label="New note" onSubmit={() => undefined} />
      ) : (
        <Text dimColor>Ask Claude to add a note.</Text>
      )}
    </Box>
  )
})
```

The same check with `'Svg' in elements` keeps the terminal, which has no `Svg`, on a text fallback.

### 3. Size to the space you get

A `Pane` or `AbovePrompt` hook sizes its tree to `e.props.bodyColumns`, the box it draws into. It is narrower than the viewport while a pane is docked beside the transcript. A change of width re-runs every hooked site, so a tree sized from `bodyColumns` stays right.

### 4. Test it on every surface

`claude plugin test` mounts a component on a surface the test names, never an assumed one. Loop the same body over the surfaces:

```tsx
for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
  const ui = await $.ui.mount({ ...PANE, surface })
  expect(await ui.find({ type: 'Text', text: /Notes/ })).toBeDefined()
  await ui.unmount()
}
```

`PANE` holds `plugin`, `component`, `requestId` and `props`, as in the skill's `pane.test.tsx` example.

## Common mistakes and how to test it

- **Assuming one surface's table.** `Svg` is not in the terminal's table, and `Raster` and `Image` are only in the terminal's. Check the table (`'Svg' in elements`) or narrow `e.surface`, and the types tell you which elements you may use.
- **A tree that does not validate.** An element the surface lacks, a prop it does not take or a child where none goes fails the hook. It is skipped alone, and the other plugins' parts still draw. The debug log, and the transcript while a plugin folder hot-reloads, name the reason.
- **Relying on `Input` on mobile.** A mobile app that does not draw it shows nothing for it. Offer another way, such as asking Claude through a registered tool.
- **Expecting the band everywhere.** In this build the declaration file raises `AbovePrompt` on the terminal, desktop and mobile surfaces only. A `Pane` is raised on every attached surface.
- **One surface in tests.** A test that mounts only `terminal` proves nothing about the others. Loop over all four.

## Going further

narsil-pet's README says its band, animations, tips and usage bars work wherever Claude Code draws them, and lists the terminal, the desktop app, VS Code and the mobile app. Its voice, notifications and floating window run on the computer where the session runs, so they depend on that system rather than on the surface. Its `ui.render` hook on `AbovePrompt` in `hooks/register.tsx` records which surfaces asked for the band, and `surfaceReport` combines that with `$.session.surfaces()`.

narsil-check's README has a table per surface: the upgrades, vulnerabilities and pending-tasks sections work on every surface, the mobile app has no field for typing tasks (they are added by asking Claude), and the environment, connectors and remote-control sections only appear in the desktop app, because they are read from the desktop app's own MCP servers. In `hooks/register.tsx`, the `Pane` hook resolves `Svg` and `Input` from the table as in step 2.
