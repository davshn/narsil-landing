---
title: The side panel
description: 'How Narsil Check draws a pane beside the chat with collapsible sections, a colored dot per section, folds it remembers and rows you copy with a click.'
route: check
order: 1
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/words.ts
  - repo: check
    path: types/index.d.ts
  - repo: check
    path: README.md
  - repo: check
    path: hooks/explain.ts
  - repo: check
    path: hooks/osv.ts
  - repo: check
    path: tests/pane.test.tsx
  - repo: check
    path: odd/tasks/vulnerabilities.md
  - repo: check
    path: odd/tasks/ecosystems-wave-2.md
---

## What it does

Narsil Check is a pane that sits beside the chat, titled **● Narsil Check**. It is the companion of Narsil, the status pet of the first path, and it speaks with her colors. Where Narsil answers "do I need to do anything right now?", the pane answers "how is this project doing?".

The pane is a column of sections, one per check: **Entorno** (the session's environment), **Conectores** (connectors), **Actualizaciones** (upgrades), **Vulnerabilidades** (vulnerabilities) and **Pendientes** (a per-project task list). The labels are Spanish, as in Narsil.

Each section has a head with three parts:

- **A colored dot** that says the most urgent thing inside the section, so you can read the pane folded.
- **An arrow**: `▾` when the section is open, `▸` when it is folded. A click on the head folds or unfolds it.
- **A name and a count**, such as `▾ Actualizaciones · 3` or `▸ Vulnerabilidades · 2`.

Inside **Actualizaciones** and **Vulnerabilidades**, each group (blocked upgrades, major versions, critical advisories and so on) folds on its own head too, and the pane remembers which ones you closed. A click on a library or an advisory copies it to the clipboard, with a short message saying whether it worked.

The value is one place to look. The README says that with the pane open you can hide the desktop app's own session bar and keep a single panel.

## How it works inside

### A pane is something you open and then draw

A mod does not get a pane by declaring it. It asks for one with `$.ui.open`, and then it draws the pane's contents in a `ui.render` hook for the `Pane` component. These are two separate steps, and both are in `hooks/register.tsx`.

The opening happens in the `session.start` hook:

```tsx
// Opens on every session: it stands in for the app's session bar.
await $.ui.open({ id: PANE, title: TITLE }).catch(() => undefined)
```

`PANE` is `'narsil-check'` and `TITLE` is `'Narsil Check'`, both in `hooks/words.ts`. The id names the pane; opening an id that is already open only retitles it, according to the 2.1.325 types.

The drawing is a hook filtered to that id:

```tsx
on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
  const { Box, Text, Button, Link } = $.ui.resolve(e)
  // ...reads the atoms and returns the tree
})
```

`$.ui.resolve(e)` gives the elements this surface can draw. The hook checks what it got: `Svg` only exists outside the terminal (so baby Narsil is drawn only there), and the mobile app gets no `Input` (so tasks are added there by asking Claude). It also reads `e.surface` to decide whether to tint the group heads: the terminal keeps the borders and draws no tints.

### What `isPlaced` means

`$.ui.open` resolves a result, `UiOpenResult` in the types. `{ isPlaced: true }` means the pane is open and drawn, and the first `ui.render` for `{ component: "Pane", requestId: id }` follows. `{ isPlaced: false, reason }` means the pane is open but not drawn yet.

The types give the rule: a pane opened in answer to the person (a command, a prompt, a press) is placed at any width. A pane the mod opens on its own waits undrawn below 144 terminal columns, or 110 once the person has asked for that id. A pane another plugin holds is refused, and the call rejects.

Narsil Check opens its pane on its own at every session start, so on a narrow terminal it may wait undrawn. The code does not read `isPlaced`; it only catches the rejection so a refused pane does not break the session start. The tests answer the `ui.open` event with `{ value: { isPlaced: true } }`, as if it was always drawn. When the person types `/narsil-check upgrade` or `/narsil-check vulns`, the command calls `$.ui.open` again, and since that open answers the person, it is placed at any width. The README describes `/narsil-check upgrade` as the way to open the pane again after closing it.

### The dot's colors

The colors are one table, `PALETTE` in `hooks/words.ts`, the same values as Narsil's states. Its comment gives the meaning: "blue for what is running or informs, gray for what rests, yellow for what waits on you, green for what is done, red for what failed or blocks".

| Color  | Value     | Meaning in the code                            |
| ------ | --------- | ---------------------------------------------- |
| Red    | `#F0435A` | Something failed or blocks.                    |
| Yellow | `#F5B400` | Something waits on you.                        |
| Green  | `#22B573` | Done, up to date, nothing to do.               |
| Blue   | `#3B8BFF` | Information, or something running.             |
| Gray   | `#8A90A6` | Resting: not read yet, or not worth attention. |

Each section picks its dot with a small pure function that checks the most urgent case first:

- **Actualizaciones**, `sectionColor`: red if the scan failed or any upgrade is blocked, yellow if a major version needs review, blue if a version is outside the Expo SDK, green otherwise, gray while the scan has not finished.
- **Vulnerabilidades**, `vulnsColor`: red for a failed check, gray before it finishes, green for none, otherwise the color of the worst severity (`SEVERITY_COLOR`: red for critical and high, yellow for moderate, gray for low or unrated).
- **Conectores**, `connectorsColor` in `hooks/session.ts`: red when they could not be read, gray before loading, yellow when one needs a sign-in or failed, green when all are up.
- **Entorno**: blue once the session is read, gray before.

Since commit `6291eaf` the same color also draws the section's rounded border (`borderStyle: 'round'`, `borderColor`), and on surfaces other than the terminal a group head is tinted with its color at low alpha (`${tone}1F`), which the comment says works on light and dark panes alike.

The reason for one function per section, instead of a color stored next to the data, is that the color can never disagree with the contents: it is computed from them on every draw.

### Folds: one atom per fold, or one list of closed keys

Every fold is state, kept in an atom (`atom` from `claude-code`). There are two shapes:

- **A section** has its own boolean atom: `isEnvOpen`, `isConnectorsOpen`, `isUpgradeOpen`, `isVulnsOpen`, `isTodosOpen`, `isCiOpen`. The head's `Button` flips it with `update($, isUpgradeOpen, value => !value)`.
- **A group inside a section** goes in one list, `closedGroups`, of the keys folded shut (such as `upgrade-blocked` or `vulns-high`). `toggleGroup` adds the key if it is missing and removes it if it is there. Every group starts open, because an empty list means nothing is closed.

The render hook reads these atoms with `read`, and a read during a draw subscribes it: when a press calls `update`, the pane draws again with no extra call.

### What it remembers, and where

This is where the code, its comments and the types need a careful reading.

At every `session.start` the hook sets the sections to fixed values: Entorno open, Conectores, Actualizaciones and Vulnerabilidades folded, and Pendientes open only when it holds tasks. Actualizaciones and Vulnerabilidades unfold by themselves when they find something. The commit that introduced this, `c07f5e9`, says "Fold state is no longer kept across sessions."

The groups (`closedGroups`) and the CI fold (`isCiOpen`) are not reset at session start. The code's comments say they keep how you left them "across sessions", and the README says the pane "recuerda cuáles cerraste" ("remembers which ones you closed").

All of them are atoms, and the atoms go through `$.state`. The 2.1.325 types describe `$.state` as "Named values held by the host for the session" that survive a hot reload of the plugin's code, and they add "Persist through `$.store`." A comment in `hooks/register.tsx` notes that a `/clear` keeps the module loaded under a new session, which is a case where an atom outlives a session. If you need a fold to survive a restart of Claude Code, the types point to `$.store`, not to an atom.

The atoms are created with a `shape` option (`{ shape: 'closed-1' }`). The types explain it: the value is kept under that tag, and a newer version of the code that names another tag finds the value absent. The comment above the atoms says to change the tag "when its type's fields change", so an old stored value never reaches code that expects new fields.

### Copy to the clipboard

Each library row and advisory row is a `plain` `Button`. Its press calls `copyRow`:

```tsx
async function copyRow($: EngineInterface, text: string, surface: Surface): Promise<void> {
  const copied = await $.ui.copy({ text, surface })
  $.ui.toast(copied.isCopied ? 'Copiado al portapapeles.' : `No pude copiar: ${copied.reason}`)
}
```

The surface comes from the press: `onPress={press => copyRow($, copy, press.surface)}`. That detail matters. The types say `$.ui.copy` puts the text "on the clipboard of a surface the session draws on", and that a press hook passes `e.surface` to name which one; left out, it is the session's first surface. A person clicking in the desktop app wants the text on the desktop's clipboard, not on a terminal attached to the same session.

The result says whether it took: `{ isCopied: true }`, or `{ isCopied: false, reason }` with a reason from a closed set (`no-surface`, `no-clipboard`, `refused`). The toast reports either case, so a copy that failed never looks like one that worked.

What gets copied is more than the row's label. Two pure functions build the text: `upgradeCopyText` in `hooks/explain.ts` (an upgrade with its jump and what blocks it or Haiku's reason) and `vulnCopyText` in `hooks/osv.ts` (an advisory with its severity, the fix and the link to OSV).

### Why the words live in `hooks/words.ts`

As in Narsil, the hooks module decides what happened and `hooks/words.ts` decides how it is said: the palette, the group labels and hints (`GROUPS`), the head labels (`sectionLabel`, `vulnsLabel`, `groupLabel`) and the colors. These are pure functions, which is why `tests/pane.test.tsx` can check them without mounting anything, as in "the section is colored by what most needs you, and its toggle names it".

## Build it with Claude

Ask Claude for a side pane with sections that fold and rows that copy. The one idea it must get right is that the pane is opened once and then drawn by a hook filtered on its own id, with every fold kept in an atom the drawing reads.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> Build a Claude Code mod called `my-panel` with a side pane. In `session.start`, call `$.ui.open({ id: 'my-panel', title: 'My panel' })` and catch a rejection. Draw it in `ui.render` for `{ component: 'Pane', requestId: 'my-panel' }` with `$.ui.resolve(e)`. Show two sections, each in a box with a rounded border in its color, and a head with a colored dot (red for failed, yellow for waiting on me, green for done, blue for information, gray before loading) and a `plain` `Button` labeled `▾ Name` or `▸ Name` that folds it. Keep the folded section keys in one atom declared in `types/index.d.ts`. Make each row a `plain` `Button` that copies its text with `$.ui.copy({ text, surface: press.surface })` and shows a toast saying whether `isCopied` was true. Check every API against the plugin-authoring types and add a test with `claude-code/testing` that a press on a head hides its rows.

### What to check in Claude's answer

1. `session.start` calls `$.ui.open` with the pane's id and title, and catches a rejection, so a pane another plugin holds does not break the session start.
2. The `ui.render` hook is filtered on `{ component: 'Pane', requestId }` with the pane's own id, and gets its elements from `$.ui.resolve(e)`.
3. Each section's dot comes from a small function that checks the most urgent case first. It is computed from the contents on every draw, not stored next to the data.
4. A press on a head changes an atom with `update`, and the pane draws again with no extra call, because the drawing reads that atom.
5. A press on a row calls `$.ui.copy` with `press.surface`, and the toast reports both cases: `isCopied` true or false.

If a check fails, tell Claude what you see: "I press a section's head and its rows stay on screen".

### How the author asked for it

The original request for the pane was not recorded. Two public task logs in narsil-check quote the author's words about parts of it.

#### Recorded: copying, and a collapsible section

`odd/tasks/vulnerabilities.md` records, in its log entry L1 (2026-11-05), the two messages that started the vulnerabilities section. S1 quotes the first one:

> "podemos checkear vulnerabilidades de la misma forma? es decir crear un sub menu de vulnerabilidades que haga pnpm audit o similar?"

In English: can we check vulnerabilities the same way, that is, create a vulnerabilities submenu that runs pnpm audit or similar?

The task log then records the proposal the author accepted with "si" ("yes"): among other things, "a collapsible section "▾ Vulnerabilidades · N" under Actualizaciones, its dot red for critical or high, yellow for moderate, green for none". That design is the agent's proposal, written in the task log; the author's words are the question and the "si".

S2 quotes the second message:

> "solo agregar que me gustaria la opcion de copiar las vulnerabilidades por criticidad al porta papeles, como esta en el upgrade"

In English: just add that I would like the option to copy the vulnerabilities by severity to the clipboard, as it is in the upgrade section.

#### Recorded: when the pane should open

`odd/tasks/ecosystems-wave-2.md` (its log starts 2026-11-04) lists in S3 the behavior that had to stay, including an earlier rule quoted in the author's words:

> "el panel solo deberia abrirse automaticamente cuando haya versiones por actualizar, ya de resto que deba abrirse con /upgrades"

In English: the pane should only open automatically when there are versions to upgrade; otherwise it should be opened with /upgrades.

That rule did not last. `/upgrades` became `/narsil-check upgrade` in `684837f`, and since `be8eac0` the pane opens on every session, because it took over the job of the app's session bar (see below).

#### Reconstruction from the commit history

From `git log -- hooks/register.tsx hooks/words.ts` in narsil-check:

- `1bf736a` (2026-11-04) "feat: add upgrade panel for npm and Expo projects". The pane starts as an upgrade list.
- `684837f` (2026-11-04) "feat!: rename to narsil-check, with /narsil-check upgrade and Narsil's look". Its message: the pane uses Narsil's palette and heads ("a colored dot and a bold name"), and the upgrade section folds from its head.
- `912478b` (2026-11-04) "feat: check known vulnerabilities with OSV.dev in a collapsible section".
- `be8eac0` (2026-11-05) "feat: show the session bar's environment, connectors and Remote Control in the pane". Its message: "The pane opens on every session".
- `c07f5e9` (2026-11-05) "feat: Entorno starts open, other sections fold until they have something". The fixed starting folds.
- `b3ad055` (2026-11-06) "feat: fold upgrade and vulnerability groups, copy a row on click, show baby Narsil and pull the branch". Its message: each group "folds on its own header and stays as left", and "A press on a library or an advisory copies it, replacing the per-group copy buttons".
- `d5b08c3` (2026-11-06) "feat: center the pane's title and baby Narsil".
- `6291eaf` (2026-11-06) "feat: give the pane a health bar, state-colored panels and tinted group heads".

The pattern: an upgrade list first, then Narsil's look, then a section per check, each time with the same head (dot, arrow, name, count), and the copy moving from one button per group to a click on the row itself.

## Reference code

This is one correct answer, written for this guide. Read it to understand how the pieces fit together and to compare it with what Claude wrote for you: Claude may choose other names or another order and still be right.

This is a reduced version of the idea, written for this guide and checked against the Claude Code 2.1.325 types. It is adapted from `hooks/register.tsx` and `hooks/words.ts` in [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later); the colors are its `PALETTE`, and the rows are synthetic.

The state's type, in `types/index.d.ts`:

```ts
declare module 'claude-code' {
  interface PluginState {
    'my-panel': { closed: string[] }
  }
}
export {}
```

The hooks module, `hooks/register.tsx`:

```tsx
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

const PANE = 'my-panel'
const COLOR = { error: '#F0435A', waiting: '#F5B400', done: '#22B573', info: '#3B8BFF' } as const

const SECTIONS = [
  {
    key: 'checks',
    title: 'Checks',
    color: COLOR.waiting,
    rows: ['lint · 2 warnings', 'build · ok'],
  },
  { key: 'notes', title: 'Notes', color: COLOR.info, rows: ['Release acme/shop on Friday'] },
]

const closed = atom({ plugin: 'my-panel', key: 'closed' } as const, [] as string[])

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await $.ui.open({ id: PANE, title: 'My panel' }).catch(() => undefined)
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const shut = new Set(await read($, closed))
    const toggle = (key: string) =>
      update($, closed, (keys) =>
        keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key],
      )
    const copy = async (text: string, surface: Parameters<typeof $.ui.copy>[0]['surface']) => {
      const copied = await $.ui.copy({ text, surface })
      $.ui.toast(copied.isCopied ? 'Copied.' : `Could not copy: ${copied.reason}`)
    }

    return (
      <Box flexDirection="column">
        {SECTIONS.map((s) => (
          <Box
            key={s.key}
            flexDirection="column"
            borderStyle="round"
            borderColor={s.color}
            paddingX={1}
            marginTop={1}
          >
            <Box flexDirection="row" gap={1}>
              <Text bold color={s.color}>
                ●
              </Text>
              <Button
                key={`section-${s.key}`}
                plain
                label={`${shut.has(s.key) ? '▸' : '▾'} ${s.title}`}
                onPress={() => toggle(s.key)}
              />
            </Box>
            {!shut.has(s.key) &&
              s.rows.map((row, i) => (
                <Button
                  key={`row-${s.key}-${i}`}
                  plain
                  label={row}
                  onPress={(press) => copy(row, press.surface)}
                />
              ))}
          </Box>
        ))}
      </Box>
    )
  })
}
```

Three details carry the design. The pane is opened once and drawn by a hook filtered on its own `requestId`, so it never draws another plugin's pane. The fold lives in an atom the render hook reads, so a press only has to `update` it. And the copy takes the press's `surface`, so the text lands where the person clicked.

## Common mistakes and how to test it

These come from Narsil Check's code and commits:

- **Assuming the pane is drawn because `open` resolved.** On a narrow terminal an unasked open resolves `{ isPlaced: false, reason }` and waits. If something depends on the pane being visible, read `isPlaced`; a command the person types opens it at any width.
- **Letting a refused open break the start.** Another plugin may hold the id and the call rejects. Narsil Check ends the call with `.catch(() => undefined)`.
- **Copying to the wrong surface.** Leaving out `surface` copies to the session's first surface. Pass `press.surface` from the button.
- **Trusting `isCopied` blindly on a terminal.** The types note that OSC 52 does not report back: a terminal that drops it, with no clipboard tool on the machine, still reads true.
- **Storing a value whose fields changed under the same tag.** Bump the atom's `shape` when its type changes, as the comment above Narsil Check's atoms says.
- **Expecting an atom to survive a restart.** The types keep `$.state` for the session and point to `$.store` for persistence.
- **Drawing tints on the terminal.** Narsil Check tints group heads only when `e.surface !== 'terminal'`; the terminal keeps the borders.

To test, `claude plugin test .` runs the mod's `*.test.tsx` files. `tests/pane.test.tsx` in narsil-check is a good model: it answers `ui.open` with `{ value: { isPlaced: true } }`, mounts the pane with `$.ui.mount({ plugin, component: 'Pane', requestId, props, surface })`, presses heads by key (`ui.press({ key: 'section-upgrade' })`) and looks for texts with `find`. Tests worth copying by name include "the section is colored by what most needs you, and its toggle names it", "baby Narsil stands under the title, light or dark as the app is; the terminal draws no picture" and "each section is a panel bordered in the color of its state; the desktop tints group heads and counts, the terminal keeps borders alone".

## Going further

The full pane in narsil-check adds a lot around the same frame:

- A health bar under the title (`healthOf` and `healthSvg` in `hooks/words.ts`) that splits the project's state into shares, one per color.
- Baby Narsil drawn as one SVG holding a light and a dark picture, switched by a `prefers-color-scheme` media query inside the SVG (`narsilSvg`), so the picture follows the app's theme with no word from the engine.
- The session sections (the next two guides) and the CI fold of your pull request (the fourth).
- **Actualizar rama** at the bottom, a `git pull -r` the mod runs itself, and a large warning at the top when the branch is behind its remote.
- The `/narsil-check` command with `upgrade`, `vulns` and `template "…"`, registered in `session.start` with `$.command.register`.
