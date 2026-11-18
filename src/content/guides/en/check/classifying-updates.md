---
title: Classifying updates
description: 'How Narsil Check sorts every outdated library into Blocked, Major version, Version bump only or Outside the Expo SDK, and why registry answers are kept six hours.'
route: check
order: 7
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/semver.ts
  - repo: check
    path: hooks/npm.ts
  - repo: check
    path: hooks/words.ts
  - repo: check
    path: types/index.d.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/upgrade.test.tsx
  - repo: check
    path: odd/tasks/release-age-all-ecosystems.md
---

## What it does

A list of fifty outdated libraries is not useful by itself. What you want to know is which ones you can raise now without thinking, which ones need reading, and which ones you should not touch yet. The **Actualizaciones** section answers that by putting every outdated library in one of four groups, drawn in this order:

| Group (label in the pane)        | In English                        | Hint under the head                             | Color  |
| -------------------------------- | --------------------------------- | ----------------------------------------------- | ------ |
| `Fuera del SDK de Expo`          | Outside the Expo SDK              | `npx expo install --fix`                        | blue   |
| `Bloqueada`                      | Blocked                           | `no se puede subir sola: el motivo está debajo` | red    |
| `Versión mayor: revisar cambios` | Major version: review the changes | `pueden romper la API`                          | yellow |
| `Solo subir la versión`          | Version bump only                 | `parche o menor`                                | green  |

The hints mean "it cannot go up alone: the reason is below", "they may break the API" and "patch or minor". The labels and hints are from `GROUPS` in `hooks/words.ts`.

Each group has a head that folds it, such as `▾ Bloqueada (2)`, and the pane remembers which ones you closed. Under each row there is a second line where it matters: in **Bloqueada**, everything that blocks it, in red; in **Versión mayor**, Haiku's reading of how hard the jump is. Only **Solo subir la versión** has a button, **Actualizar las N** ("Update the N"), and it never takes a library from another group.

Libraries that are current do not appear. The line under the section's head counts the rest, in the groups' order:

```text
6 para actualizar de 31 · 2 bloqueadas · 2 mayores · 2 triviales
```

That is "6 to update out of 31 · 2 blocked · 2 major · 2 trivial". With nothing to do it says `Todo al día · 31 librerías revisadas` ("All up to date · 31 libraries checked").

The section's colored dot says the most urgent group present: red if anything is blocked, else yellow for a major, else blue for Expo, else green.

## How it works inside

### The type: four groups and a list of reasons

`types/index.d.ts` defines the group as a union, `'bump' | 'review' | 'expo' | 'blocked'`, and every `Upgrade` carries one, with its `bump` (`'patch' | 'minor' | 'major'`) and `conflicts: string[]`. The comments on `Group` still say `blocked` is for a peer dependency only; the code and the README give it more reasons now (below).

The design separates two questions. `bump` is how far apart the versions are, a fact. `group` is what the person should do, a decision that can change as more is known. A patch can be `blocked`; a major is `review` unless something blocks it.

### Step 1: how far is the jump

Every ecosystem starts the same way, with `bumpOf(installed, latest)` from `hooks/semver.ts`:

```ts
export function bumpOf(from: Version, to: Version): Bump {
  if (compare(to, from) <= 0) return 'none'
  if (to.major !== from.major) return 'major'
  if (to.minor !== from.minor) return from.major === 0 ? 'major' : 'minor'
  if (to.patch !== from.patch) return from.major === 0 && from.minor === 0 ? 'major' : 'patch'
  return 'patch'
}
```

It is quoted from [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). `none` means current (or the registry's latest is older than what you have) and the library is left out. Otherwise `major` goes to `review` and `patch` or `minor` to `bump`.

### Versions below 1.0.0

The two middle lines carry the rule the comment states: "Below 1.0.0 a minor is a breaking change (0.3 -> 0.4) and below 0.1.0 so is a patch, as npm's caret ranges treat them."

This follows semantic versioning's own convention that 0.x is unstable, and npm's `^` reads it the same way: `^0.3.2` accepts `0.3.9` but not `0.4.0`, and `^0.0.3` accepts nothing but `0.0.3`. If the pane called 0.3 to 0.4 a minor, the upgrade button would raise across a change the package's own author marked as breaking. The tests pin all three cases: `0.3.1 → 0.4.0` is major, `0.3.1 → 0.3.2` is a patch, `0.0.3 → 0.0.4` is major.

The README states the first half only: "un salto de minor por debajo de 1.0.0" ("a minor jump below 1.0.0"). The patch rule below 0.1.0 is in the code and the tests, not in the README.

`bumpOf` is shared, so the rule applies to every ecosystem, including those whose own tools read 0.x differently.

### Step 2: npm and the Expo SDK

An Expo app pins the native modules each SDK is built against, in `bundledNativeModules.json`. Installing a newer one than that table allows breaks the native build, so in an Expo project "the table wins over npm". `upgradeOf` in `hooks/npm.ts` checks it before anything else:

- **The installed version is outside the SDK's range**: the upgrade goes to `expo`, with the SDK's range as its target. That is the **Fuera del SDK de Expo** group, and its hint is the command that fixes it.
- **The installed version is inside the range, and npm has a newer one**: the answer is `'held'`, not an upgrade. It is counted, not listed, and a note says those libraries "tienen versión nueva en npm, pero el SDK de Expo la fija: se suben con el SDK" ("have a new version on npm, but the Expo SDK pins it: they go up with the SDK").

The table comes from `node_modules/expo/bundledNativeModules.json` when installed, else from `https://unpkg.com/expo@<version>/bundledNativeModules.json` for the installed Expo version. The `expo` package itself is never judged by its own table.

### Step 3: anything that blocks it

Last, any upgrade that has a reason not to go up alone moves to `blocked`, whatever its jump. The reasons are kept as words in `conflicts`, and those words are what the pane prints under the row.

For npm (`scanNpm`), the reasons are the peer dependencies and the pins of the next guide, plus the 24-hour wait. For every other ecosystem (`scanGeneric`):

- **A comment that holds the version on purpose**, found by `holdNote`: `Fijada a propósito: «…»` ("Pinned on purpose"), with the comment itself.
- **What the ecosystem knows it breaks**, from the adapter's `conflictsOf`: Kotlin and its compiler plugins, the Android Gradle Plugin and the Gradle wrapper, a Swift package pinned to one exact version.
- **The 24-hour wait**: a version published less than a day ago, such as `Publicada hace 3 h: Narsil Check espera 24 h antes de subirla` ("Published 3 h ago: Narsil Check waits 24 h before raising it").

The wait covers the Expo group too: the version the SDK's range resolves to is held to the same day, and an Expo upgrade still waiting moves to `blocked` with the command in its reason.

The order matters for one reason: `blocked` is decided last, so it overrides everything. A trivial patch that a plugin refuses is not trivial.

### Where it is drawn

The `ui.render` hook draws `GROUPS` in order, filtering `state.upgrades` by `u.group`; inside a group, an upgrade that fixes known vulnerabilities goes first. A blocked row's second line is `u.conflicts.join(' · ')` in red. `sortUpgrades` orders the list by group, then dependencies before devDependencies, then by name.

### The six-hour cache

Asking every registry for every library at every session start would be slow and would put real load on public registries for answers that rarely change. `latestIn` in `hooks/register.tsx` keeps each answer:

```ts
// A registry answer is reused for this long, across sessions and projects.
const CACHE_MS = 6 * 60 * 60 * 1000
```

```ts
const key = `${adapter.id}:${name}`
const cached = (await $.store.get(key)) as Cached | undefined
if (!isFresh && cached && Date.now() - cached.at < CACHE_MS) return cached.version
```

Both are quoted from [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). After a fetch, the answer is written back with `$.store.set(key, { version, at: Date.now() })`.

**Where it is stored.** `$.store` is, in the 2.1.325 types' words, "This plugin's own key-value store, kept between sessions and hot reloads", "A JSON file of the plugin's own under the user's Claude Code configuration directory". That is why the comment says "across sessions and projects": the key is the ecosystem and the package name (`npm:react`), not the project, so a second project that uses react reuses the answer. The types also say `set` rejects "a store over 4 MiB of JSON text in all", a limit every key of the mod shares.

**When it is skipped.** `isFresh` is set by **Revisar de nuevo** ("Check again"), by `/narsil-check upgrade`, after the upgrade button, after the pull request button and after a successful branch pull. A fresh scan asks every registry again and writes the new answers. The scan at session start is not fresh, so it uses what is under six hours old. The README says the same: "Cada respuesta se guarda 6 horas, y el botón **Revisar de nuevo** fuerza una consulta nueva" ("Each answer is kept 6 hours, and the **Revisar de nuevo** button forces a new query").

**Why six hours.** Neither the code, the README nor the commits give a reason for the number; `CACHE_MS` has been six hours since the first commit, `1bf736a`. Reading the trade-off: a shorter cache would ask every registry at nearly every session start, and a longer one would hide a release for most of a working day. Six hours is shorter than the 24-hour wait, so a release the cache hides for a while could not have gone up anyway in that time. That reasoning is an interpretation, not a recorded decision.

**What is kept for good instead.** Some answers never change once a version is published, so the mod keeps them without a timer: a version's peer dependencies (`peers:<name>@<version>`), its publication date (`published:…`, only when it is a valid date) and Haiku's reading of a major (`why:…`).

## Build it with Claude

Ask Claude to sort every outdated library into a group that says what you should do with it. The one idea it must get right is that the jump and the decision are separate: `bump` says how far apart the versions are, `group` says what to do, and `blocked` is decided last.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> In my Claude Code mod `my-panel`, I have a list of outdated npm libraries, each with its installed and latest version. Sort them into groups: `blocked` (a list of reasons in words is not empty), `review` (a major jump), `bump` (a patch or minor). Write `bumpOf(from, to)` as a pure function: none, patch, minor or major, where below 1.0.0 a minor counts as major and below 0.1.0 a patch does too, as npm's caret ranges read them. Decide `blocked` last so it overrides the others. Draw the groups in the order blocked, review, bump, each with a foldable head `▾ Label (N)` and a hint line, and the reasons under a blocked row in red. Only the bump group gets an "Update all" button. Cache each registry answer in `$.store` under `npm:<name>` with the time, reuse it for six hours, and skip the cache when the person presses "Check again". Test `bumpOf` with 0.x cases and the cache with `mock.clock`.

### What to check in Claude's answer

1. `bumpOf` is a pure function that returns none, patch, minor or major, and a library with none is left out of the list.
2. Below 1.0.0 a minor counts as major (`0.3.1 → 0.4.0`), and below 0.1.0 a patch does too (`0.0.3 → 0.0.4`).
3. `blocked` is decided last, so an upgrade with any reason is blocked whatever its jump, and its reasons are printed under it in red.
4. Only the `bump` group has the "Update all" button, and it never takes a library from another group.
5. Each registry answer is kept in `$.store` under `npm:<name>` with the time, reused for six hours, and skipped when you press "Check again".

If a check fails, tell Claude what you see: "a patch that a plugin refuses still shows in the bump group, and the button would install it".

### How the author asked for it

The original request for the four groups was not recorded: they are already in the first commit, and no public task log covers them. The reasons for **Bloqueada** grew later, and one of them is recorded in the author's words.

#### Recorded: the 24-hour wait in every ecosystem

`odd/tasks/release-age-all-ecosystems.md`, log entry L1 (2026-11-06), quotes the author. The first message asked about frameworks other than Expo:

> "Y el cuánto a expo, pasa igual con frameworks como kmp o alguno de los otros lenguajes? Tenemos que pensar en ellos?"

In English: "And as for Expo, does the same happen with frameworks like KMP or any of the other languages? Do we have to think about them?" Then:

> "El primero me interesa, deberíamos implementar algo similar para los otros lenguajes, es más seguro"

In English: "I'm interested in the first one; we should implement something similar for the other languages, it is safer." And then: "24 horas está perfecto" ("24 hours is perfect").

The same log's S4 quotes an earlier rule of the author's, kept from a previous fix:

> "siempre que haya minimumReleaseAge se bloquee la actualizacion automatica y se marque el bloqueo, sin excepcion alguna"

In English: "whenever there is a minimumReleaseAge, block the automatic upgrade and mark the block, with no exception at all." That is why no exclusion list counts anywhere, and why a date that cannot be read blocks too.

A correction came the same day. L7 quotes the author's question:

> "que pasa si una version siempre trae fecha ilegible? nunca la vamos a actualizar?"

In English: "what happens if a version always comes with an unreadable date? are we never going to update it?" The task log records the accepted proposal ("si hazlo asi", "yes, do it that way"): such a version waits 24 hours from when the mod first saw it. That fallback and the rest of the design are the agent's proposal, written in the log; the author's words are the question and the "si".

#### Reconstruction from the commit history

From `git log -- hooks/semver.ts hooks/words.ts` and `git log -S` on the group labels, in narsil-check:

- `1bf736a` (2026-11-04) "feat: add upgrade panel for npm and Expo projects". Its message: the pane "lists the project's outdated libraries by how hard each upgrade is". The four groups, `bumpOf` with the 0.x rule and `CACHE_MS` are all here. The blocked group was then labeled `Bloqueada por otras dependencias` ("Blocked by other dependencies"), with plain terminal colors (red, magenta, yellow, green).
- `4ea9be0` (2026-11-04) "feat: block upgrades kept on purpose and Kotlin past its compiler plugins". Its message: "The blocked group is now just Bloqueada, since a dependency is no longer its only reason."
- `690c1bb` (2026-11-06) "feat: block upgrades pnpm would refuse under minimumReleaseAge", then `54ac6aa` (2026-11-06) "fix: block every upgrade under pnpm's minimumReleaseAge, with no exceptions".
- `1492ca5` (2026-11-06) "feat: hold every ecosystem's upgrades for 24 hours after release", and `ca13b3c` (2026-11-06) "feat: hold Expo SDK-pinned versions for 24 hours too".
- `54cd243` (2026-11-06) "feat: let a version with no readable date go up a day after it was first seen". The L7 correction.

The pattern: the groups were right from the start, and what changed was the meaning of **Bloqueada**, from "another dependency refuses it" to "anything we know makes it unsafe to raise alone".

## Reference code

This is one correct answer, written for this guide. Read it to understand how the pieces fit together and to compare it with what Claude wrote for you: Claude may choose other names or another order and still be right.

This is a reduced version of the idea, written for this guide and checked against the Claude Code 2.1.325 types. It is adapted from `hooks/semver.ts`, `hooks/npm.ts` and `hooks/register.tsx` in [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). It leaves out Expo and the reasons themselves; `reasons` is whatever your checks found.

```ts
import type { EngineInterface } from 'claude-code'

type V = { major: number; minor: number; patch: number }
export type Group = 'blocked' | 'review' | 'bump'

export function parse(text: string): V | undefined {
  const m = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(text.trim())
  return m ? { major: +m[1], minor: +(m[2] ?? 0), patch: +(m[3] ?? 0) } : undefined
}

export function bumpOf(from: V, to: V): 'none' | 'patch' | 'minor' | 'major' {
  const d = to.major - from.major || to.minor - from.minor || to.patch - from.patch
  if (d <= 0) return 'none'
  if (to.major !== from.major) return 'major'
  if (to.minor !== from.minor) return from.major === 0 ? 'major' : 'minor'
  return from.major === 0 && from.minor === 0 ? 'major' : 'patch'
}

export function groupOf(from: V, to: V, reasons: string[]): Group | undefined {
  const bump = bumpOf(from, to)
  if (bump === 'none') return undefined
  if (reasons.length > 0) return 'blocked'
  return bump === 'major' ? 'review' : 'bump'
}

const CACHE_MS = 6 * 60 * 60 * 1000
type Cached = { version: string; at: number }

export async function latest(
  $: EngineInterface,
  name: string,
  isFresh: boolean,
): Promise<string | undefined> {
  const key = `npm:${name}`
  const cached = (await $.store.get(key)) as Cached | undefined
  if (!isFresh && cached && Date.now() - cached.at < CACHE_MS) return cached.version
  const res = await $.http.fetch(`https://registry.npmjs.org/${name.replace('/', '%2F')}/latest`, {
    headers: { accept: 'application/json' },
  })
  const version = res.ok ? (JSON.parse(res.text) as { version?: string }).version : undefined
  if (version) await $.store.set(key, { version, at: Date.now() } satisfies Cached)
  return version
}
```

Call `latest` for each declared dependency from a scan that a hook never awaits, then `groupOf` with the installed version and the reasons your checks found, and keep the list in an atom. In the pane, draw one foldable block per group in the order of `Group`, and the **Update all** button only under `bump`. The reduced `parse` ignores prereleases and fourth parts, which `hooks/semver.ts` handles.

## Common mistakes and how to test it

These come from Narsil Check's code and commits:

- **Mixing the jump with the decision.** Keep `bump` (a fact) and `group` (what to do) apart, so a blocked patch is still known to be a patch.
- **Deciding blocked first.** A later rule that sets `review` or `bump` would undo it. Narsil Check's npm scan even loops until no group changes, because blocking one upgrade can block a sibling.
- **Reading 0.x like 1.x.** `0.3 → 0.4` is breaking. So is `0.0.3 → 0.0.4`.
- **A blocked row with no reason.** The group says "the reason is below"; an empty line breaks that promise. Keep the reasons as words.
- **A button that takes everything.** It must take the `bump` group only; the test "a blocked upgrade shows what blocks it and the button leaves it out" checks it.
- **Caching by project.** The latest version of a package is the same in every project. Key it by ecosystem and name.
- **Caching what never changes with a timer.** Peers and publication dates of a published version can be kept for good; latest versions cannot.
- **Caching garbage.** Only a valid date is kept for the 24-hour wait, so "the next scan asks again".

To test, `tests/upgrade.test.tsx` has "the jump between two versions" (with the 0.x cases), "each dependency lands in its group", "the Expo SDK table wins over npm for the modules it pins" and "the summary counts each group". The pane tests use `$.ui.mount` and `ui.press`: "a press on a library copies it, with no copy buttons, and each group folds on its own". The release-age tests, such as "a version younger than minimumReleaseAge says how long it still waits" and "a version whose date nobody can read goes up a day after the mod first saw it, and an answer that is not a date is never kept", cover the blocked reasons with time.

## Going further

- The next guide explains npm's own blocking reasons: the peers of the new version, the peers of what is installed, and exact pins in the dependency tree.
- Haiku's line under each major is asked once per jump and kept for good, so its cost does not repeat.
- The six-hour constant is one line. A mod with fewer libraries could lower it; one used on many large projects could raise it.
