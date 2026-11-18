---
title: Dependencies that block each other
description: 'How Narsil Check finds npm upgrades that cannot go up alone: peers the new version asks for, peers installed packages ask for, and exact pins in the tree.'
route: check
order: 9
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/npm.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/semver.ts
  - repo: check
    path: hooks/words.ts
  - repo: check
    path: types/index.d.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/upgrade.test.tsx
  - repo: check
    path: odd/tasks/ecosystems-wave-2.md
---

## What it does

Some upgrades look trivial and are not. eslint 9.39 to 10 is a major you might read about and accept, but if one of your installed ESLint plugins only accepts eslint 9, the install will either fail or leave a project that does not lint. A patch can be worse: raising a package that another package pins to one exact version leaves two copies of it installed, and some tools break when they load twice.

Narsil Check checks this before it offers anything. In an npm project, an upgrade that one of these checks refuses goes to the **Bloqueada** ("Blocked") group, whatever the size of its jump, with the reason written under it in red. The upgrade button, **Actualizar las N**, never includes it.

The reasons are sentences, built from the data, in the pane's Spanish:

| Reason in the pane                                                                     | In English                                                           |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `eslint-plugin-astro 3.2.1 necesita eslint >=10.0.0 (tienes 9.39.5)`                   | The new version needs a peer you have at another version.            |
| `eslint-config-love exige eslint ^9.35.0`                                              | An installed package asks for this one in a range the new leaves.    |
| `typescript-eslint 8.71.0 fija @typescript-eslint/parser 8.71.0: quedarían dos copias` | A package in the tree pins the old version: two copies would remain. |

"necesita" is "needs", "tienes" is "you have", "exige" is "demands", and "fija … quedarían dos copias" is "pins …, two copies would remain". These examples are the README's own and the tests', with well-known public packages.

When one upgrade has several reasons, they are joined with `·` on the same line. A press on the row copies the library with its jump and what blocks it, so you can paste it into a conversation and ask how to untangle it.

These checks exist for npm only. The README section opens with "Solo en npm" ("npm only"), and the other ecosystems block for their own reasons (the previous guide lists them).

## How it works inside

### Three checks, both directions

The design question was: what makes a version unable to go up alone? The answer in `hooks/npm.ts` is three relations, read from data and never guessed by a model:

1. **What the new version asks for.** Its `peerDependencies`, compared with what the project has installed.
2. **What the installed packages ask for.** Each installed package's `peerDependencies` on this one, compared with the new version.
3. **What the tree pins.** Any package in the lockfile that depends on this one at one exact version that is not the new one.

The first two are the two directions of the same relation, and both are needed: a plugin that moves to require eslint 10 is caught by the first, and an eslint 10 that your old config refuses is caught by the second.

### Where the data comes from

For the first check, the new version's manifest is fetched from `https://registry.npmjs.org/<name>/<version>` (`versionUrl`). `targetPeers` in `hooks/register.tsx` keeps the answer in `$.store` under `peers:<name>@<version>` with no expiry, because, as its comment says, "A version never changes once published, so its answer is kept for good."

For the second, each declared dependency's installed manifest is read from `node_modules/<name>/package.json`. When there is no `node_modules` (a repository just cloned or made from a template), `lockedPackage` reads the same information from `package-lock.json`, or from `pnpm-lock.yaml` through `pnpmLocked`. That fallback came in `24dfeb1`, after a project not installed yet "showed no 'exige' blocks, so eslint and typescript upgrades its plugins refuse looked safe".

One detail the README does not spell out: the second check reads the peers of the project's **declared** dependencies, the ones in `package.json`, because `scanNpm` fills `installedMap` from that list. A transitive package's own peer ranges are not compared. The third check is the one that reaches the whole tree.

For the third, `pinConflicts` reads `package-lock.json`'s `packages` map, which in lockfile versions 2 and 3 lists every installed package by path, the nested ones included. The README states the consequence: "Esta comprobación usa `package-lock.json`, así que con yarn, pnpm o bun no se hace" ("This check uses `package-lock.json`, so with yarn, pnpm or bun it is not done").

### The peer check

```ts
export function peerConflicts(
  name: string,
  target: Installed,
  installed: Map<string, Installed>,
): string[] {
  const conflicts: string[] = []
  for (const [peer, range] of Object.entries(target.peers)) {
    const have = installed.get(peer)
    if (have && !satisfies(have.version, range))
      conflicts.push(
        `${name} ${show(target.version)} necesita ${peer} ${range} (tienes ${show(have.version)})`,
      )
  }
  for (const [other, have] of installed) {
    if (other === name) continue
    const range = have.peers[name]
    if (range && !satisfies(target.version, range))
      conflicts.push(`${other} exige ${name} ${range}`)
  }
  return conflicts
}
```

It is quoted from [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Three decisions are visible in it:

- **A peer you do not have is not a conflict.** `have` is `undefined` and nothing is pushed. The comment: "A peer the project does not have is npm's to add, not a conflict."
- **Ranges are read the way npm reads them.** `satisfies` from `hooks/semver.ts` handles `||`, hyphen ranges, `^`, `~`, partial versions and `*`, so a peer range like `^8.57.0 || ^9.0.0 || ^10.0.0` is understood. A comparator it cannot read counts as met, "so an unknown range never raises a false alarm".
- **The reason names both sides.** The first form says what the new version needs and what you have; the second says who refuses and what it accepts. Either is enough to decide what to raise first.

`installedFromManifest` also records which peers `peerDependenciesMeta` marks as optional, but `peerConflicts` does not read that list: an optional peer the project has installed, at a version outside the range, blocks like any other.

### The pin check

Two copies of a package are usually harmless. They are not for a plugin that registers itself, or a singleton. The code's comment gives the example of ESLint's "Cannot redefine plugin", and the README the case: `typescript-eslint` 8.71.0 pins `@typescript-eslint/parser` 8.71.0, so raising the parser alone to 8.72.1 makes ESLint load the plugin twice.

`pinConflicts` looks at every package in the lockfile, at any depth, and reads its `dependencies` and `optionalDependencies` on the package being raised. It reports only when all of these hold:

- the range is an exact pin (`isExactPin`: `8.71.0` or `=8.71.0`, nothing else);
- the new version does not satisfy it;
- the owner is not part of a family that goes up together (below).

A range that is not exact, such as `^8.53.0`, is left alone: "a nested copy there is usually harmless". That choice keeps the check quiet; a pin is a deliberate statement by the package's author, a range is not.

### Families that move together

Some families publish every member at the same version and pin each other to it: `typescript-eslint` with its parser and plugin, `@tailwindcss/*` with `tailwindcss`. Raising them one by one would always look blocked. Raising them together is fine, because every pin moves to the new version at once.

So `pinConflicts` takes a `batch`: the trivial upgrades the button would install together, by name and new version. A pin does not count when its owner goes up in the batch to the same version. It also follows chains: the comment's example is `@tailwindcss/vite`, which pins `@tailwindcss/node`, which pins `tailwindcss`. Packages pinned in lockstep by a carried package are carried too, repeated until nothing new is added.

### Deciding, then deciding again

The batch depends on which upgrades are trivial, and which are trivial depends on the pins. `scanNpm` resolves that with a loop:

```ts
for (let changed = true; changed;) {
  changed = false
  const batch = new Map(
    upgrades.filter((u) => u.group === 'bump').map((u) => [u.name, u.latest] as const),
  )
  for (const u of upgrades) {
    const own = peers.get(u)
    const version = parseVersion(u.latest)
    if (own === undefined || !version) continue
    u.conflicts = [...own, ...(young.get(u) ?? []), ...pinConflicts(u.name, version, lock, batch)]
    const group = u.conflicts.length > 0 ? 'blocked' : u.bump === 'major' ? 'review' : 'bump'
    if (group !== u.group) {
      u.group = group
      changed = true
    }
  }
}
```

It is quoted from [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). The comment above it: "a blocked one leaves the batch, which can block a sibling it carried". The loop ends when a pass changes no group. `young` holds the 24-hour wait's reasons, so they land in the same list. Upgrades in the Expo group skip the peer check (`peers` has no entry for them, so the loop skips them too); they go through `npx expo install --fix` instead.

### What it compares with

The checks compare with what is installed now. The README is honest about the limit: "si subes varias juntas, puede que el bloqueo se resuelva entre ellas" ("if you raise several together, the block may resolve between them"). Only the pin check knows about the batch; a peer conflict between two upgrades that would both go up is still shown. That is the safe side: the pane may stop you when you could have gone on, but it does not wave through an upgrade that breaks.

## Build it with Claude

Ask Claude for checks that tell you when an npm upgrade cannot go up alone, before the upgrade is offered. The one idea it must get right is that both directions count: what the new version asks for, and what your installed packages ask for.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> In my Claude Code mod `my-panel`, before I mark an npm upgrade as safe, check whether it can go up alone. Write pure functions in `hooks/npm.ts`. `peerConflicts(name, target, installed)`: for each `peerDependencies` entry of the new version, if the project has that peer installed at a version outside the range, say "<name> <version> needs <peer> <range> (you have <version>)"; for each installed package whose `peerDependencies` names this package with a range the new version leaves, say "<other> requires <name> <range>". A peer the project does not have is not a conflict. `pinConflicts(name, target, lock)`: for every package in `package-lock.json`'s `packages` that depends on this one at an exact version (`1.2.3` or `=1.2.3`) the new one is not, say "<owner> <version> pins <name> <range>: two copies would remain". Read version ranges with a `satisfies` that handles `||`, `^`, `~` and hyphen ranges and treats what it cannot read as met. In the hooks module, fetch the new version's manifest from `https://registry.npmjs.org/<name>/<version>` with `$.http.fetch` and keep it in `$.store` for good. Put any upgrade with a reason in a "blocked" group and print the reasons under it. Test with synthetic manifests and lockfiles.

### What to check in Claude's answer

1. `peerConflicts` compares both directions: the new version's `peerDependencies` with what you have installed, and each installed package's `peerDependencies` on this package with the new version.
2. A peer the project does not have is not a conflict, so nothing is reported for it.
3. `pinConflicts` reports only exact pins (`1.2.3` or `=1.2.3`) that the new version does not satisfy. A range such as `^8.53.0` is left alone.
4. `satisfies` reads `||`, `^`, `~` and hyphen ranges, and treats a range it cannot read as met, so `^8.57.0 || ^9.0.0 || ^10.0.0` does not block every plugin.
5. Any upgrade with a reason goes to the blocked group with its reasons printed under it, and the new version's manifest is fetched from `https://registry.npmjs.org/<name>/<version>` once and kept in `$.store` for good.

If a check fails, tell Claude what you see: "eslint 10 shows as a safe upgrade, but my ESLint config only accepts eslint 9".

### How the author asked for it

The original request for these checks was not recorded. They are already in the first commit, and no public task log covers them.

#### Recorded in a task log, not in the author's words

`odd/tasks/ecosystems-wave-2.md` records a decision about them when the other ecosystems arrived. It is an assumption written in the task log by the agent, not the author's words:

> "Assumption: peer dependency and exact-pin checks stay npm-only; Go majors are new module paths (`/v2`), so a Go major is found by probing `<module>/vN/@latest`."

That is why the README section still begins with "Solo en npm".

#### Reconstruction from the commit history

From `git log -- hooks/npm.ts` and `git log -S` on `peerConflicts`, `pinConflicts` and `lockedPackage` in narsil-check:

- `1bf736a` (2026-11-04) "feat: add upgrade panel for npm and Expo projects". Its message names "upgrades blocked by peer dependencies or exact pins in the lockfile". `peerConflicts`, `pinConflicts` and the lockstep batch are all in this first commit.
- `a95eb07` (2026-11-04) "refactor: read dependencies through an adapter per ecosystem". npm "keeps what only npm has (Expo, node_modules, peer and pin checks)".
- `4ea9be0` (2026-11-04) "feat: block upgrades kept on purpose and Kotlin past its compiler plugins". The group's label changes from `Bloqueada por otras dependencias` ("Blocked by other dependencies") to `Bloqueada`, "since a dependency is no longer its only reason".
- `24dfeb1` (2026-11-07) "fix: read peer dependencies from the lockfile when node_modules is missing". Its message describes the bug the reader would not have noticed: a project not installed yet showed no blocks, so refused upgrades "looked safe".

The pattern: the checks were designed whole from the start, and the one correction was about where the data comes from, not about the rule.

## Reference code

This is one correct answer, written for this guide. Read it to understand how the pieces fit together and to compare it with what Claude wrote for you: Claude may choose other names or another order and still be right.

This is a reduced version of the idea, written for this guide and checked against the Claude Code 2.1.325 types. It is adapted from `hooks/npm.ts` and `hooks/register.tsx` in [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). It handles caret, tilde, exact and `>=` ranges only, and leaves out families that move together.

The pure part, `hooks/peers.ts`:

```ts
type V = [number, number, number]
const parse = (t: string): V | undefined => {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(t.trim())
  return m ? [+m[1], +m[2], +m[3]] : undefined
}
const cmp = (a: V, b: V) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]

// Enough of npm's ranges for the example: ^, ~, >=, exact, joined by ||.
export function satisfies(version: string, range: string): boolean {
  const v = parse(version)
  if (!v) return true
  return range.split('||').some((part) => {
    const m = /^\s*(\^|~|>=|=)?\s*v?(\d+\.\d+\.\d+)\s*$/.exec(part)
    const b = m && parse(m[2])
    if (!m || !b) return true // a range it cannot read never raises a false alarm
    const atLeast = cmp(v, b) >= 0
    if (m[1] === '>=') return atLeast
    if (m[1] === '~') return atLeast && v[0] === b[0] && v[1] === b[1]
    if (m[1] === '^') return atLeast && (b[0] > 0 ? v[0] === b[0] : v[0] === 0 && v[1] === b[1])
    return cmp(v, b) === 0
  })
}

export type Pkg = { version: string; peers: Record<string, string> }

export function peerConflicts(name: string, target: Pkg, installed: Map<string, Pkg>): string[] {
  const out: string[] = []
  for (const [peer, range] of Object.entries(target.peers)) {
    const have = installed.get(peer)
    if (have && !satisfies(have.version, range))
      out.push(`${name} ${target.version} needs ${peer} ${range} (you have ${have.version})`)
  }
  for (const [other, pkg] of installed) {
    const range = other === name ? undefined : pkg.peers[name]
    if (range && !satisfies(target.version, range)) out.push(`${other} requires ${name} ${range}`)
  }
  return out
}

type Lock = {
  packages?: Record<string, { version?: string; dependencies?: Record<string, string> }>
}

export function pinConflicts(name: string, target: string, lock: Lock): string[] {
  const out: string[] = []
  for (const [path, entry] of Object.entries(lock.packages ?? {})) {
    const owner = path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length)
    const range = entry.dependencies?.[name]
    if (!path.includes('node_modules/') || owner === name || !range) continue
    if (/^=?\d+\.\d+\.\d+$/.test(range.trim()) && !satisfies(target, range))
      out.push(`${owner} ${entry.version ?? ''} pins ${name} ${range}: two copies would remain`)
  }
  return out
}
```

The hooks module's part, fetching the new version's peers once:

```ts
import type { EngineInterface } from 'claude-code'
import type { Pkg } from './peers'

export async function targetPeers(
  $: EngineInterface,
  name: string,
  version: string,
): Promise<Pkg | undefined> {
  const key = `peers:${name}@${version}`
  const kept = (await $.store.get(key)) as Pkg | undefined
  if (kept) return kept
  const res = await $.http.fetch(
    `https://registry.npmjs.org/${name.replace('/', '%2F')}/${version}`,
    { headers: { accept: 'application/json' } },
  )
  if (!res.ok) return undefined
  const manifest = JSON.parse(res.text) as { peerDependencies?: Record<string, string> }
  const pkg = { version, peers: manifest.peerDependencies ?? {} }
  await $.store.set(key, pkg)
  return pkg
}
```

Build `installed` from each declared dependency's `node_modules/<name>/package.json`, read with `$.fs.read`, as `{ version, peers: peerDependencies ?? {} }`. For each upgrade, join `peerConflicts` and `pinConflicts` (with `package-lock.json` parsed as `lock`); any reason makes it blocked, and the reasons are its second line in the pane.

## Common mistakes and how to test it

These come from Narsil Check's code, README and commits:

- **Checking one direction only.** The new version's peers and the installed packages' peers are different questions; eslint 10 with an old config fails the second, a new plugin with an old eslint fails the first.
- **Treating a missing peer as a conflict.** npm adds it. Only a peer you have at a wrong version blocks.
- **Reading only `node_modules`.** A fresh clone has none, and then nothing blocks. That is the bug `24dfeb1` fixed by reading the lockfiles.
- **Flagging every nested copy.** Most are harmless. Report exact pins only.
- **Blocking a family that moves together.** Pins inside a family raised to the same version are fine; without the batch, `typescript-eslint` or `@tailwindcss/*` would look blocked forever.
- **Deciding once.** Blocking one upgrade removes it from the batch and can block a sibling; loop until no group changes.
- **A range parser that is too strict.** If it fails on `^8.57.0 || ^9.0.0 || ^10.0.0`, every plugin looks incompatible. Treat what you cannot read as met.
- **Fetching the same version's manifest every scan.** A published version never changes; keep its peers for good.

To test, `tests/upgrade.test.tsx` builds an installed set with synthetic peers and checks the sentences exactly: "typescript 7 is blocked by the packages that ask for an older one", "eslint 10 is blocked by the configs and plugins that stop at 9", "eslint-plugin-astro 3 is blocked by the eslint it needs" and "an upgrade every peer accepts has no conflicts". "peer ranges as packages write them" pins `satisfies` on real-world range shapes. For pins: "only a range naming one version is an exact pin", "a package in the tree that pins the old version leaves two copies" and "a family that goes up together carries its pins, through its own members too". Through the pane: "a blocked upgrade shows what blocks it and the button leaves it out", "the button leaves out an upgrade a package in the tree pins", "without node_modules, the lockfiles say what a package asks for" and "a pnpm project with no node_modules still blocks an upgrade its installed plugins refuse".

## Going further

- The pin check needs `package-lock.json`. Reading the nested packages of `pnpm-lock.yaml` the same way would extend it to pnpm projects, which the README says are not covered today.
- The peer check could also learn about the batch, so that two upgrades that only conflict with each other's old versions are offered together.
- Copying a blocked row gives Claude both sides of the conflict in one line: a good start for asking which package to raise first.
