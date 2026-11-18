---
title: Updating the trivial ones
description: 'How the Actualizar las N button raises every patch and minor at once, keeping each range operator and section, then runs the install tool of each ecosystem.'
route: check
order: 12
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/adapter.ts
  - repo: check
    path: hooks/npm.ts
  - repo: check
    path: hooks/pypi.ts
  - repo: check
    path: hooks/cargo.ts
  - repo: check
    path: hooks/pub.ts
  - repo: check
    path: hooks/rubygems.ts
  - repo: check
    path: hooks/words.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/upgrade.test.tsx
  - repo: check
    path: odd/tasks/release-age-all-ecosystems.md
---

## What it does

Most of an outdated list is patches and minors that nothing blocks. Raising them one by one is tedious, and it is where mistakes creep in: a `^` lost, a dev tool moved into `dependencies`, a lockfile not refreshed. Narsil Check does them in one press.

Under the **Solo subir la versión** ("Version bump only") group there is one button, **Actualizar las N** ("Update the N"), or **Actualizar esta librería** ("Update this library") when there is one. While it runs, the pane says `Actualizando 6 librerías con npm…` ("Updating 6 libraries with npm…") and the button is gone. When it finishes, a toast says `Actualicé 6 librerías con npm.` ("I updated 6 libraries with npm.") and the pane adds a reminder:

```text
Actualicé 6 librerías. Ejecuta los tests antes de hacer commit.
```

That is "I updated 6 libraries. Run the tests before committing." Then the list is scanned again, from the registries, so what you see is what is now true.

Each library keeps the shape it had. The README gives the examples: `^3.22.0` becomes `^3.25.1`, and `>=2.31,<3` becomes `>=2.34.2,<3`. A dev dependency stays a dev dependency.

### What "trivial" means here

Only the `bump` group goes up: a patch or minor jump (by the 0.x rule of guide 7) with no blocking reason. Majors, Expo's SDK-pinned modules and anything in **Bloqueada** are never touched. The README is careful about the word: "'Trivial' solo significa que el salto no es mayor y que no choca con lo que el panel sabe: no garantiza que el proyecto compile." In English: "'Trivial' only means the jump is not major and does not clash with what the panel knows: it does not guarantee the project builds." That is why the last message asks you to run the tests.

## How it works inside

### One plan per ecosystem

`upgradeBumps` in `hooks/register.tsx` takes the `bump` rows of the last scan, groups them by ecosystem, and runs each ecosystem with its own tool. A second press while one runs does nothing: the job's `running` state is checked first.

For each ecosystem the steps are the same, and each comes from the adapter contract in `hooks/adapter.ts`:

1. **Read the files** the adapter lists (manifests and lockfiles that exist).
2. **Resolve pins** when the rewrite needs a command to say something first (`pinCommand`): GitHub Actions pinned to a commit need the new tag's commit. If one cannot be read, that ecosystem is skipped and its files are not written.
3. **Rewrite** the manifests (`rewrite`), when the ecosystem is rewritten by the mod.
4. **Install** with the commands `installArgv` builds.

### npm: the package manager writes `package.json`

npm has no `rewrite`. The mod builds the install command and lets the package manager edit `package.json` and the lockfile. Which manager is decided by the lockfile present: `pnpm-lock.yaml`, `yarn.lock`, `bun.lock` or `bun.lockb`, else npm.

The range comes from `rangeFor` in `hooks/npm.ts`:

```ts
export function rangeFor(spec: string, latest: string): string {
  const prefix = /^(\^|~)/.exec(spec.trim())?.[1] ?? ''
  return `${prefix}${latest}`
}
```

And the section from `installArgv`, which makes one command for `dependencies` and one for `devDependencies`:

```ts
for (const isDev of [false, true]) {
  const names = upgrades
    .filter((u) => u.isDev === isDev)
    .map((u) => `${u.name}@${rangeFor(u.spec, u.latest)}`)
  if (names.length > 0) argv.push([manager, ...add, ...(isDev ? [dev] : []), ...names])
}
```

Both are quoted from [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). `add` is `install` for npm and `add` for the others; `dev` is `--save-dev` for npm and `-D` for the others. The test "dependencies and devDependencies install in their own sections" expects, for three upgrades:

```text
npm install a@^1.1.0 c@^1.1.0
npm install --save-dev b@^1.1.0
```

Two consequences of `rangeFor` are worth knowing. Only `^` and `~` are carried: any other prefix, such as `>=`, is dropped and the version goes in bare. And for a version with no prefix, what ends up in `package.json` is the package manager's own decision; the code passes the bare version, and the tests check the command, not the written file. If your project relies on exact versions, check the result or set the manager's own option for exact saves.

### The other ecosystems: rewrite the line, keep every other byte

Every other ecosystem rewrites its manifest itself, line by line, and changes only the version. Each adapter has a small function that swaps the first version in a requirement and keeps its operator; PyPI and Pub also keep an upper bound:

| Ecosystem | Function       | Example from its comment or tests           |
| --------- | -------------- | ------------------------------------------- |
| PyPI      | `pySpecFor`    | `>=2.31,<3` → `>=2.34.2,<3`                 |
| Cargo     | `cargoSpecFor` | keeps `^`, `~`, `=` or `>=`; drops the rest |
| Pub       | `pubSpecFor`   | `>=1.0.0 <2.0.0` → `>=1.6.0 <2.0.0`         |
| RubyGems  | `gemSpecFor`   | keeps `~>`, `>=` and the like               |

Because the line is edited where it is, the section never changes: a crate under `[dev-dependencies]` stays there, a Python package in `requirements-dev.txt` stays there. Cargo's `rewriteCargo` even tracks the table header it is in, so it only touches lines under `[dependencies]`, `[dev-dependencies]`, `[build-dependencies]` (and their `target` forms) or a crate's own `[dependencies.<name>]` table. Their comments describe the goal the same way: "every other byte as it was".

Why rewrite instead of calling each tool's "add" command? The code does not say it in one place, but the comments show the reasoning: a rewrite keeps the person's formatting, comments and range style, and works the same whether the tool is installed or not. The tool is then used only for what it alone can do, the lockfile.

### Running the install afterwards

Yes, the mod runs it. Each adapter's `installArgv` says what, from the README's table and the code:

| Ecosystem                             | After the rewrite                                                   |
| ------------------------------------- | ------------------------------------------------------------------- |
| npm                                   | `npm install` / `pnpm add` / `yarn add` / `bun add`, as above       |
| PyPI                                  | `uv lock` or `poetry lock`; with only `requirements.txt`, nothing   |
| Go                                    | `go get <module>@<version>` and `go mod tidy` (no rewrite)          |
| Cargo                                 | `cargo update -p <crate>` for each one                              |
| Pub                                   | `flutter pub get` or `dart pub get`                                 |
| NuGet                                 | `dotnet restore`                                                    |
| RubyGems                              | `bundle update --conservative <gems>`                               |
| SwiftPM                               | `swift package update`, or `xcodebuild -resolvePackageDependencies` |
| Maven, Gradle wrapper, GitHub Actions | nothing: the next build or run downloads it                         |

With only `requirements.txt`, the README says so: there is no lockfile, so the button rewrites the pins and "no instala nada" ("installs nothing"); you install in your own environment.

npm and pnpm run under the 24-hour wait of guide 9, through the environment `releaseAgeEnv` builds and the `env` field of `$.process.run` (in the types, "Variables set over the host process's own environment"). A young dependency anywhere in the tree fails the install instead of landing in the lockfile.

### When something fails

Three cases, each handled differently in `upgradeBumps`:

- **The tool is not on this machine** (`xcodebuild` outside a Mac, `cargo` not installed: the run rejects with `ENOENT`). The rewritten files of that ecosystem are written back as they were, so a raised manifest never goes out with a stale lockfile, and the others continue. The pane says which one stayed, for example "Cargo quedó sin actualizar (2 librerías): no pude ejecutar cargo en este equipo y dejé sus archivos como estaban." ("Cargo was not updated (2 libraries): I could not run cargo on this machine and left its files as they were.")
- **The tool runs and fails.** The pane shows the command, its exit code and the end of its output, or the wait's own message when pnpm or npm refused a young version, and scans again. The ecosystems after it are not attempted, and the files already rewritten stay; `git diff` shows them.
- **Anything else throws.** "No pude ejecutar …" ("I could not run …") with the error.

## How it was asked of the AI

The original request for the button was not recorded: it is in the first commit, and no public task log covers its creation.

### Recorded in a task log

The task log `odd/tasks/release-age-all-ecosystems.md` records, in the agent's words, how the install step was checked when the 24-hour wait reached it. Its task T3 is "npm installs with `before` set to 24 hours ago", and entry L3 notes that with `npm_config_before` a day back, npm refused an hour-old release of tailwindcss and resolved its range to the previous version. That is evidence the agent gathered, not a request.

`odd/tasks/ecosystems-wave-2.md` lists "the bump button" in S3, among what had to keep working as new ecosystems were added; that is the agent's spec too.

### Reconstruction from the commit history

From `git log -S rangeFor`, `git log -S upgradeBumps` and the per-ecosystem commits in narsil-check:

- `1bf736a` (2026-11-04) "feat: add upgrade panel for npm and Expo projects". Its message: "trivial bumps it installs in one press". `rangeFor`, the two-section `installArgv` and `upgradeBumps` are here.
- `a95eb07` (2026-11-04) "refactor: read dependencies through an adapter per ecosystem". Other ecosystems "get a generic scan, install and pending check".
- `bbe6519`, `8ae479e`, `503ba95`, `06bcc49` (2026-11-04): "list and upgrade" Rust crates, Python packages, Dart and Flutter packages, Ruby gems. Each brings its own spec function and rewrite.
- `8c5f2a3` (2026-11-06) "feat: install npm and pnpm upgrades under the 24-hour wait through the whole tree".
- `7125ffd` (2026-11-09) "fix: stop the upgrade button from breaking builds it cannot check". Its message: "Skip an ecosystem whose tool is not on the machine, such as xcodebuild outside a Mac, restoring its manifests so a raised version never goes out with a stale lockfile. The other ecosystems still go up." It also took Gradle lockfile pins and exact Swift pins out of "trivial".

The pattern: the button was there from the first commit, and later work narrowed what "trivial" may include and what happens when a tool is missing.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> In my Claude Code mod `my-panel`, add an "Update all" button under the npm upgrades that are a patch or minor and not blocked. Pick the package manager from the lockfile (pnpm, yarn, bun, else npm). Keep each range's prefix: `^1.2.0` with latest 1.4.0 becomes `^1.4.0`, `~` stays `~`, no prefix stays none. Run one command for `dependencies` and one with `--save-dev` (or `-D`) for `devDependencies`, with `$.process.run` and a timeout. While it runs, hide the button and show "Updating N libraries with <manager>…"; a second press must do nothing. On a non-zero exit, show the command, its exit code and the last lines of stderr. On success, toast "Updated N libraries" and say "Run the tests before committing". Scan again from the registries either way. Test that the commands for three upgrades, one of them dev, are exactly two, and that a blocked or major upgrade is never in them.

## The minimal code

This is a reduced version of the idea, written for this guide and checked against the Claude Code 2.1.325 types (`$.process.run`, `$.ui.toast`). It is adapted from `hooks/npm.ts` and `hooks/register.tsx` in [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). npm only; `rescan` is your own scan.

```ts
import type { EngineInterface } from 'claude-code'

type Bump = { name: string; spec: string; latest: string; isDev: boolean }
type Manager = 'npm' | 'pnpm' | 'yarn' | 'bun'

export function rangeFor(spec: string, latest: string): string {
  const prefix = /^(\^|~)/.exec(spec.trim())?.[1] ?? ''
  return `${prefix}${latest}`
}

export function installArgv(manager: Manager, bumps: Bump[]): string[][] {
  const add = manager === 'npm' ? 'install' : 'add'
  const dev = manager === 'npm' ? '--save-dev' : '-D'
  const argv: string[][] = []
  for (const isDev of [false, true]) {
    const names = bumps
      .filter((b) => b.isDev === isDev)
      .map((b) => `${b.name}@${rangeFor(b.spec, b.latest)}`)
    if (names.length > 0) argv.push([manager, add, ...(isDev ? [dev] : []), ...names])
  }
  return argv
}

let isRunning = false

export async function upgradeAll(
  $: EngineInterface,
  manager: Manager,
  bumps: Bump[],
  rescan: () => Promise<void>,
): Promise<string | undefined> {
  if (isRunning || bumps.length === 0) return undefined
  isRunning = true
  try {
    for (const argv of installArgv(manager, bumps)) {
      const ran = await $.process.run(argv, { timeoutMs: 300_000 })
      if (ran.exitCode !== 0) {
        const tail = (ran.stderr || ran.stdout).trim().split('\n').slice(-5).join('\n')
        return `${argv.slice(0, 2).join(' ')} exited with ${ran.exitCode}:\n${tail}`
      }
    }
    $.ui.toast(`Updated ${bumps.length} libraries with ${manager}.`)
    return 'Run the tests before committing.'
  } finally {
    isRunning = false
    await rescan()
  }
}
```

Keep the returned message in an atom and draw it under the button. For a second ecosystem, add a rewrite step before the install that replaces only the version on the dependency's own line, and write the original files back if the tool turns out to be missing.

## Common mistakes and how to test it

These come from Narsil Check's code, tests and commits:

- **Losing the operator.** `^1.2.0` written back as `1.4.0` changes what the project accepts from then on. Carry the prefix.
- **Moving a dev dependency.** One install command for everything puts dev tools in `dependencies` (or the reverse). Split by section.
- **Raising more than the safe group.** The button must take `bump` only; "a blocked upgrade shows what blocks it and the button leaves it out" checks it.
- **A manifest without its lockfile.** Raising `Cargo.toml` with no `cargo` to refresh `Cargo.lock` leaves the two out of step. Restore the manifest when the tool is missing.
- **Reformatting the file.** Parsing a TOML or YAML file and writing it back loses comments and order. Edit the one line.
- **Not scanning again.** After an install, the list you show must be the new truth, success or failure.
- **Calling it safe.** A patch can still break a build. Say "run the tests", as the pane does.

To test, `claude plugin test .` runs `tests/upgrade.test.tsx`: "an upgrade keeps the range prefix package.json wrote" (`^3.22.0` → `^3.25.1`, `~5.4.0` → `~5.9.3`, `1.2.0` → `1.3.0`), "dependencies and devDependencies install in their own sections", "the button installs the trivial upgrades and scans again" and "a failed install says why and keeps the list". Each other ecosystem's test file checks its own rewrite, for example the PyPI and Cargo files for the operator and the upper bound.

## Going further

- Once the manifests differ from `HEAD`, the pane offers to commit them, push and open a pull request. That is a later guide of this path.
- `rangeFor` carries only `^` and `~`. Extending it to `>=` or to `x`-ranges is a small change with a test per case.
- A team that wants the tests run automatically could chain a test command after the install; Narsil Check leaves that to you on purpose, with the reminder.
