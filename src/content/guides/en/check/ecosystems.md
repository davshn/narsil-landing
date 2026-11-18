---
title: One adapter per ecosystem
description: 'How Narsil Check reads eleven package ecosystems through one small contract: each adapter reads its manifest, asks its registry and says how to raise a version.'
route: check
order: 6
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/adapter.ts
  - repo: check
    path: hooks/ecosystems.ts
  - repo: check
    path: hooks/npm.ts
  - repo: check
    path: hooks/semver.ts
  - repo: check
    path: hooks/toml.ts
  - repo: check
    path: hooks/pypi.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: types/index.d.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/contract.test.tsx
  - repo: check
    path: tests/pypi.test.tsx
  - repo: check
    path: odd/tasks/ecosystems-wave-2.md
  - repo: check
    path: odd/tasks/ecosystems-wave-3.md
  - repo: check
    path: odd/tasks/ecosystems-wave-4.md
---

## What it does

The **Actualizaciones** section lists the libraries of the project that have a newer version, whatever language the project is written in. A repository with a web front end and a Python service gets one list, with each row naming its ecosystem at the end when there is more than one:

```text
zod 3.22.4 → 3.25.1 · npm
requests 2.31.0 → 2.32.3 · PyPI
```

For the person, nothing changes from one language to another: the same groups, the same copy on click, the same button that raises the trivial ones. Behind that sameness there is one adapter per ecosystem, and this guide is about that design.

The ecosystems the mod reads, as listed in `ADAPTERS` in `hooks/ecosystems.ts`, in that order:

| Adapter          | Languages             | Reads                                                          | Asks                                   |
| ---------------- | --------------------- | -------------------------------------------------------------- | -------------------------------------- |
| `npm`            | JavaScript, TS (Expo) | `package.json`, `package-lock.json`, `pnpm-lock.yaml`          | registry.npmjs.org                     |
| `pypi`           | Python                | `pyproject.toml`, `requirements.txt`, `uv.lock`/`poetry.lock`  | pypi.org                               |
| `go`             | Go                    | `go.mod`                                                       | proxy.golang.org                       |
| `cargo`          | Rust                  | `Cargo.toml`, `Cargo.lock`                                     | crates.io                              |
| `pub`            | Dart, Flutter         | `pubspec.yaml`, `pubspec.lock`                                 | pub.dev                                |
| `maven`          | Kotlin, Java          | `gradle/libs.versions.toml`, `build.gradle(.kts)`, `pom.xml`   | Maven Central, Google Maven, Plugin P. |
| `gradle-wrapper` | Gradle itself         | `gradle/wrapper/gradle-wrapper.properties`                     | services.gradle.org                    |
| `nuget`          | C#, F#, VB            | `*.csproj`, `*.fsproj`, `*.vbproj`, `Directory.Packages.props` | api.nuget.org                          |
| `rubygems`       | Ruby                  | `Gemfile`, `Gemfile.lock`                                      | rubygems.org                           |
| `swiftpm`        | Swift                 | `Package.swift`, Xcode's `project.pbxproj`, `Package.resolved` | each package's git tags                |
| `actions`        | GitHub Actions        | the `uses:` lines of `.github/workflows` and `.github/actions` | each action's git tags                 |

That is eleven adapters. The README's **Ecosistemas** table has the same eleven rows. Its vulnerabilities section speaks of "los nueve ecosistemas" ("the nine ecosystems"), and so does the release-age task log ("all nine ecosystems"): both count the package ecosystems of the time, before the Gradle wrapper and GitHub Actions adapters arrived in `7048580`.

## How it works inside

### The idea: pure adapters, one engine

`hooks/adapter.ts` opens with the rule the whole design rests on:

> An adapter is pure: the hooks module reads the files it names, fetches the addresses it gives and runs the commands it builds.

An adapter never calls `$`. It is an object of plain values and plain functions: file names, URL builders, parsers, command builders. The hooks module (`hooks/register.tsx`) is the only place that touches the disk, the network or a process. So there is one engine and many descriptions, and each description can be tested with text fixtures and no toolchain at all.

That last point was not theoretical. The wave 2 task log records: "No Python, Cargo or Dart toolchain and no project of those ecosystems on this machine: adapters are checked with fixtures and against the live registries only." A design where the adapter ran `cargo` itself could not have been built on that machine.

### The three questions every adapter answers

The `Adapter` type has many fields, most of them optional. The required ones answer three questions.

**1. What does the project declare, and what is installed?**

- `manifests`: the files whose presence says the project uses this ecosystem, at the root (`package.json`). `globs` adds manifests anywhere in the tree (`**/*.csproj`).
- `lockfiles`: where installed versions are recorded.
- `parse(files)`: turns the text of those files into a list of `Dep`, each `{ name, spec, isDev, installed? }`. `spec` is the range or version the manifest writes (`^18.2.0`, `>=2.31,<3`), `installed` what a lockfile records.

**2. What is the newest release?**

- `latestUrl(name)`: where the registry answers, with `headers` to send.
- `latestOf(text)`: reads the version out of that answer.

**3. How does a version go up?**

- `installArgv(present, upgrades, files)`: the commands that raise the trivial upgrades (`npm install …`, `uv lock`, `cargo update -p …`).
- `rewrite(files, upgrades, pins)`, optional: the files written before those commands, for ecosystems whose tool does not edit the manifest itself.
- `managerOf(present)`: the tool's name, for the button's note.

Everything else is an extension a later feature needed, and each one is a sentence in the type's comments: `releasedUrls` and `releasedOf` for the 24-hour wait, `repoUrlOf` and `importPattern` for Haiku's reading of a major, `treeOf` for the vulnerabilities check, `conflictsOf` for an ecosystem that knows what an upgrade breaks (Kotlin and its compiler plugins). Three fields exist because one ecosystem did not fit:

- `latestCommand` (SwiftPM, GitHub Actions): there is no registry, so the newest tag comes from `git ls-remote --tags --refs` on the package's own repository.
- `nextMajor` (Go): a Go major from v2 on is a new module path (`/v2`), so the registry's "latest" never leaves the current major. The engine asks for each next major until one is missing.
- `alternateUrl` (Maven): a Gradle plugin published as a library is on the Plugin Portal, not Maven Central, so a miss on the first registry asks the second.

### The registry of ecosystems

`hooks/ecosystems.ts` is short. It defines the npm adapter and collects all of them:

```ts
export const ADAPTERS: Adapter[] = [
  NPM,
  PYPI,
  GO,
  CARGO,
  PUB,
  MAVEN,
  GRADLE_WRAPPER,
  NUGET,
  RUBYGEMS,
  SWIFTPM,
  ACTIONS,
]

export function adapterOf(id: Ecosystem): Adapter {
  return ADAPTERS.find((a) => a.id === id) ?? NPM
}
```

It is quoted from [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). The `Ecosystem` union in `types/index.d.ts` lists the same eleven ids, so an upgrade row carries its ecosystem and the engine finds its adapter back with `adapterOf`.

Detection is "each adapter whose manifest is there". `presentOf` in `hooks/register.tsx` checks each manifest, lockfile and context file with `$.fs.exists`, and for globs runs `git ls-files --cached --others --exclude-standard`, which lists what git tracks or would track and so leaves build output out. Outside a git repository only root manifests count.

### What the engine does with an adapter

For any ecosystem but npm, `scanGeneric` is the whole loop:

1. Read the present files with `$.fs.read` (a file too large or unreadable is skipped: "the adapter does without it").
2. `adapter.parse(files)` gives the declared dependencies.
3. For each, the installed version is `installed`, else the version the range is written from (`baseOf`).
4. `latestIn` asks the registry: `$.http.fetch(adapter.latestUrl(name), { headers })`, or `$.process.run(adapter.latestCommand(name))`, and reads it with `adapter.latestOf`. The answer is kept in `$.store` for six hours (the next guide explains the cache).
5. `bumpOf(installed, latest)` from `hooks/semver.ts` says patch, minor or major, and the upgrade lands in its group.

The upgrade button does the third question: for each ecosystem with trivial upgrades it writes what `rewrite` returns, then runs each `installArgv` command. If the tool is not on the machine (`xcodebuild` outside a Mac), the rewritten files are put back, "raised manifests would go out with a stale lockfile, so they go back", and the other ecosystems still go up.

### npm, the reference adapter

npm was the first ecosystem, the only one in the first commit. When the adapters arrived, in `a95eb07`, "npm becomes the first adapter and keeps what only npm has (Expo, node_modules, peer and pin checks)". So npm has an adapter like the others, used for detection, the button, release notes and the vulnerability tree, and also a scan of its own, `scanNpm`, for what the generic loop does not know.

Its pieces live in `hooks/npm.ts` and are assembled in `hooks/ecosystems.ts`:

- `parseManifest` reads `dependencies` and `devDependencies`, the first one winning when a name is in both.
- `lockedVersion` reads `packages["node_modules/<name>"].version` from `package-lock.json` (v2 and v3).
- `latestUrl` asks `https://registry.npmjs.org/<name>/latest`, "a small document, unlike the package's full record". A scoped name keeps its `@` and escapes its slash: `@types%2Fnode`.
- `managerOf` picks npm, pnpm, yarn or bun from the lockfile present, the first found in `LOCKFILES` winning.
- `installArgv` builds one command for dependencies and one for devDependencies, "so each package stays in its own section", and `rangeFor` keeps the range's prefix: `^1.2.0` becomes `^1.4.0`, an exact pin stays exact.

npm has no `rewrite`: `npm install name@^1.4.0` writes `package.json` itself.

### Versions: one arithmetic for everyone

`hooks/semver.ts` is shared by every adapter. Its `Version` is `{ major, minor, patch, pre, rest? }`. `rest` holds a fourth part and beyond, because RubyGems and NuGet use them (Rails `8.1.4.1`); it came with the Maven wave in `c50e830`. The pattern also accepts a Maven qualifier after a dot (`5.6.15.Final`) and a leading `v`.

It exports four things the rest of the mod relies on:

- `compare`: major, minor, patch, then the extra parts, and a prerelease before its release.
- `bumpOf`: the kind of jump, with the rule for versions below 1.0.0 (next guide).
- `baseOf`: the version a range is written from, `undefined` for what names none (`workspace:*`, a git URL, `latest`).
- `satisfies`: whether a version meets an npm-style range, with `||`, hyphen ranges, `^`, `~`, partial versions and `*`. Its comment states a design choice worth copying: "A comparator it cannot read is taken as met, so an unknown range never raises a false alarm."

### A small TOML reader

Cargo, Python and the Gradle version catalog write TOML. `hooks/toml.ts` is "a small TOML reader": tables, arrays of tables, dotted and quoted keys, the string kinds, numbers, booleans, dates as text, arrays and inline tables. It throws on malformed input, and callers catch it (an unreadable `uv.lock` makes versions come from the requirements instead).

Why write one? The mod has no `package.json` of its own: its hooks import only `claude-code` and its own files. Every parser it needs, TOML, YAML for `pnpm-lock.yaml` (read line by line in `pnpmLocked`), versions and ranges, lives in the repository. The reader's header lists Cargo and Python files; `hooks/maven.ts` imports it too, for `libs.versions.toml`.

## Build it with Claude

Ask Claude to turn your list of outdated libraries into one engine with a pure adapter per ecosystem. The one idea it must get right is that an adapter never calls `$`: it names files, builds addresses and commands, and parses text, while the hooks module does all the reading, fetching and running.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> In my Claude Code mod `my-panel`, I list outdated npm dependencies. Refactor it so each package ecosystem is a pure adapter object in its own file under `hooks/`, with no calls to `$`: `id`, `label`, `manifests` (file names), `lockfiles`, `parse(files: Record<string, string>)` returning `{ name, spec, isDev, installed? }[]`, `latestUrl(name)`, `latestOf(text)` and `installArgv(present, upgrades)`. Keep all I/O in `hooks/register.tsx`: check which manifests exist with `$.fs.exists`, read them with `$.fs.read`, fetch `latestUrl` with `$.http.fetch`, and run `installArgv` with `$.process.run`. Make npm the first adapter with no change in behavior, proven by the existing tests. Then add a PyPI adapter for `requirements.txt` against `https://pypi.org/pypi/<name>/json` (`info.version`). Test each adapter as pure functions with text fixtures and a synthetic registry answer.

### What to check in Claude's answer

1. No adapter calls `$`. `$.fs.exists`, `$.fs.read`, `$.http.fetch` and `$.process.run` appear only in `hooks/register.tsx`.
2. Each adapter has `manifests`, `lockfiles`, `parse`, `latestUrl`, `latestOf` and `installArgv`. A field only one ecosystem needs is optional.
3. npm becomes the first adapter with no change in behavior, and the existing tests still pass.
4. A scoped npm name keeps its `@` and escapes its slash in the URL (`@types%2Fnode`).
5. Each adapter is tested as pure functions with text fixtures and a synthetic registry answer, with no ecosystem toolchain installed.

If a check fails, tell Claude what you see: "the PyPI tests fail on a machine with no Python, because the adapter runs a command itself".

### How the author asked for it

The adapters were built in three waves on 2026-11-04, each with a public task log in narsil-check. The task logs record the author's words, and also the plan the waves followed; the two are kept apart below.

#### Recorded: wave 2

`odd/tasks/ecosystems-wave-2.md`, log entry L1 (2026-11-04), quotes the author:

> "camos con la oleada 2", then "espera primero sube a github - main y luego sigue con la oleada 2".

In English: "let's go with wave 2" ("camos" is a typo for "vamos"), then "wait, first push to GitHub, main, and then go on with wave 2".

S1 records the plan the wave followed, under "The user's request, as wave 2 was planned in this conversation":

> "2. **PyPI, Go, Cargo y Pub.** Tienen registros con APIs JSON sencillas."

In English: "2. PyPI, Go, Cargo and Pub. They have registries with simple JSON APIs." The log does not say who wrote that line of the plan. The same S1 adds, in the task log's own words, that "Each ecosystem's adapter follows the shared contract: `detect`, `parse`, `latest`, `importPattern` (the planned contract), plus an install command for the bump group." The contract that shipped named those steps `manifests`, `parse`, `latestUrl`/`latestOf` and `installArgv`. Its stated assumption: "peer dependency and exact-pin checks stay npm-only".

#### Recorded: wave 3

`odd/tasks/ecosystems-wave-3.md`, L1 (2026-11-04), quotes the author: "dale a la oleada 3" ("go ahead with wave 3"). Its S1 records the plan:

> "3. **Maven (Kotlin/Java), NuGet y RubyGems.** Gradle es lo más difícil de leer, porque `build.gradle.kts` es código. Leería el catálogo de versiones con exactitud y los `build.gradle.kts` lo mejor posible."

In English: "3. Maven (Kotlin/Java), NuGet and RubyGems. Gradle is the hardest to read, because `build.gradle.kts` is code. I would read the version catalog exactly and the `build.gradle.kts` files as well as possible." The first person ("Leería", "I would read") reads like a proposal the author then accepted with "dale a la oleada 3"; the log does not say more.

That plan is why the README says a Gradle version kept in a variable "es código y queda fuera" ("is code and is left out").

#### Recorded: wave 4

`odd/tasks/ecosystems-wave-4.md`, L1 (2026-11-04), quotes the author: "dale a la oleada 4" ("go ahead with wave 4"). Its S1 records the plan:

> "4. **SwiftPM.** Lo dejo para el final porque depende de la API de GitHub, que tiene límite de peticiones."

In English: "4. SwiftPM. I leave it for the end because it depends on GitHub's API, which has a request limit."

Here the plan changed along the way. The task log's assumption: "tags are read with `git ls-remote --tags --refs <url>` instead of the GitHub API, which has no request limit and works for any git host". That is where the contract got `latestCommand`, in `8444155` "feat: let an adapter answer its latest version with a command".

#### Reconstruction from the commit history

Wave 1, npm alone, has no task log, so its request was not recorded. From `git log -- hooks/adapter.ts hooks/ecosystems.ts hooks/toml.ts hooks/semver.ts`:

- `1bf736a` (2026-11-04) "feat: add upgrade panel for npm and Expo projects". `semver.ts` and `npm.ts` arrive; there are no adapters yet.
- `a95eb07` (2026-11-04) "refactor: read dependencies through an adapter per ecosystem". The contract, with npm as the first adapter "with no change in behaviour", as the wave 2 log says for T1.
- `bbe6519`, `8ae479e`, `90f8502`, `503ba95` (2026-11-04): Cargo (with `toml.ts`), PyPI, Go and Pub, one commit each.
- `c50e830` (2026-11-04) "feat: find manifests anywhere in the tree and read four-part versions": the contract grows `globs` and `Version.rest` before Maven, NuGet and RubyGems (`4f9b8ea`, `1362623`, `06bcc49`).
- `8444155` and `83c0029` (2026-11-04): `latestCommand`, then SwiftPM.
- `1492ca5` (2026-11-06) "feat: hold every ecosystem's upgrades for 24 hours after release": `releasedUrls` and `releasedOf` in every adapter.
- `7048580` (2026-11-09) "feat: check the Gradle wrapper and GitHub Actions for upgrades": the tenth and eleventh adapters.

The pattern: first make the existing ecosystem an adapter without changing its behavior, then add one ecosystem per commit, and grow the contract by one optional field each time an ecosystem does not fit.

## Reference code

This is one correct answer, written for this guide. Read it to understand how the pieces fit together and to compare it with what Claude wrote for you: Claude may choose other names or another order and still be right.

This is a reduced version of the idea, written for this guide and checked against the Claude Code 2.1.325 types. It is adapted from `hooks/adapter.ts`, `hooks/npm.ts` and `hooks/register.tsx` in [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). It reads versions from the manifest only, with no lockfile.

The contract and the npm adapter, `hooks/adapter.ts`:

```ts
export type Dep = { name: string; spec: string; isDev: boolean }
export type Files = Record<string, string>

export type Adapter = {
  id: string
  manifests: string[]
  parse: (files: Files) => Dep[]
  latestUrl: (name: string) => string
  latestOf: (text: string) => string | undefined
  installArgv: (upgrades: { name: string; latest: string; isDev: boolean }[]) => string[][]
}

export const NPM: Adapter = {
  id: 'npm',
  manifests: ['package.json'],
  parse: (files) => {
    const json = JSON.parse(files['package.json'] ?? '{}') as Record<string, Record<string, string>>
    return (['dependencies', 'devDependencies'] as const).flatMap((field) =>
      Object.entries(json[field] ?? {}).map(([name, spec]) => ({
        name,
        spec,
        isDev: field === 'devDependencies',
      })),
    )
  },
  latestUrl: (name) => `https://registry.npmjs.org/${name.replace('/', '%2F')}/latest`,
  latestOf: (text) => (JSON.parse(text) as { version?: string }).version,
  installArgv: (upgrades) =>
    [false, true]
      .map((isDev) =>
        upgrades.filter((u) => u.isDev === isDev).map((u) => `${u.name}@^${u.latest}`),
      )
      .flatMap((names, i) =>
        names.length ? [['npm', 'install', ...(i ? ['--save-dev'] : []), ...names]] : [],
      ),
}

export const ADAPTERS: Adapter[] = [NPM]
```

The engine, in `hooks/register.tsx`:

```tsx
import type { EngineInterface } from 'claude-code'
import { ADAPTERS } from './adapter'
import type { Adapter } from './adapter'

const major = (v: string) => Number(/\d+/.exec(v)?.[0] ?? 0)
const clean = (spec: string) => /\d+(\.\d+){0,2}/.exec(spec)?.[0]

export async function scan($: EngineInterface) {
  const rows: { ecosystem: string; name: string; from: string; to: string; isMajor: boolean }[] = []
  for (const adapter of ADAPTERS) {
    const files: Record<string, string> = {}
    for (const path of adapter.manifests)
      if (await $.fs.exists(path)) files[path] = await $.fs.read(path)
    if (Object.keys(files).length === 0) continue
    for (const dep of adapter.parse(files)) {
      const from = clean(dep.spec)
      if (!from) continue
      const res = await $.http.fetch(adapter.latestUrl(dep.name), {
        headers: { accept: 'application/json' },
      })
      const to = res.ok ? adapter.latestOf(res.text) : undefined
      if (to && to !== from)
        rows.push({
          ecosystem: adapter.id,
          name: dep.name,
          from,
          to,
          isMajor: major(to) !== major(from),
        })
    }
  }
  return rows
}
```

Call `scan` from a function that is never awaited by a hook, keep the rows in an atom, and draw them in the pane. The reduced engine treats any different version as newer and any major change as major; Narsil Check compares with `compare` and `bumpOf` from `hooks/semver.ts`, reads the installed version from the lockfile, asks for up to eight libraries at once, and caches the answers.

### Exercise: add PyPI

Add a second adapter, `PYPI`, to `ADAPTERS` without touching `scan`. It needs:

- `manifests: ['requirements.txt']`.
- `parse`: one dependency per line, skipping comments and option lines (`-r`, `--index-url`), the name before the first operator (`==`, `>=`, `~=`), and the rest as `spec`.
- `latestUrl`: `https://pypi.org/pypi/<name>/json`.
- `latestOf`: `info.version` of that JSON.
- `installArgv`: `[]` when there is no lockfile, since rewriting `requirements.txt` is the whole upgrade (that is what Narsil Check does too: "con solo `requirements.txt` no hay lockfile, así que el botón reescribe los pins y no instala nada", "with only `requirements.txt` there is no lockfile, so the button rewrites the pins and installs nothing"). Your contract then needs a `rewrite`.

When it works, compare with the reference answer, `hooks/pypi.ts` in narsil-check. It shows what a real adapter adds: PEP 503 name normalization (`Foo_Bar` and `foo-bar` are one package), extras and markers in PEP 508 (`Django[argon2]~=4.2 ; python_version > '3.8'`), `pyproject.toml` read with `parseToml`, installed versions from `uv.lock` or `poetry.lock`, a `rewrite` that raises only the first version and keeps an upper bound (`>=2.31,<3` becomes `>=2.34.2,<3`), and an import-name table for Haiku (`pyyaml` is imported as `yaml`).

## Common mistakes and how to test it

These come from Narsil Check's code and task logs:

- **Letting the adapter do I/O.** Then it cannot be tested without the ecosystem's tools. Keep it pure, and let the engine read, fetch and run.
- **One adapter that knows too much.** npm's Expo, peer and pin logic stayed in npm's own scan. A field only one ecosystem needs is optional, never required of all.
- **Scoped and special names.** npm's `@scope/name` must escape its slash in the URL. PyPI compares names normalized. Go's majors are other paths.
- **Trusting "latest".** Maven's `<release>` can be a prerelease (the wave 3 log found `2.12.0-alpha05`), so the stable maximum comes from the full list.
- **Registries with rules of their own.** crates.io refuses a request with no User-Agent, as a comment in `hooks/cargo.ts` says, so its adapter sends one in `headers`.
- **Rewriting more than the version.** A `rewrite` that reformats a manifest makes a noisy diff. Narsil Check's rewrites change the version and "every other byte as it was".
- **A test that fakes every process.** The wave 3 log records "A test mock that simulated the npm install on every process call broke once the scan began calling git ls-files". Answer only the commands the test is about.

To test, `tests/contract.test.tsx` checks the shared pieces: "a version may have a fourth part, and it counts", "a glob matches at any depth with \*\*/ and within one directory with \*", "the manifests are the root ones and the globbed ones, never a lockfile". Each ecosystem has its own file; `tests/pypi.test.tsx` has "a PEP 508 requirement is a name and its specifier, without extras or markers", "raising a requirement keeps its operators and upper bound, and every other byte", "PyPI's answer gives the latest release and the GitHub repository" and, through the pane, "a uv project lists its packages and the button raises pyproject.toml and runs uv lock" and "a project with two ecosystems names each library's".

## Going further

- The next guide follows an upgrade from `bumpOf` to its group, and explains the six-hour cache `latestIn` uses.
- The adapters' optional fields are a map of the mod's later features: read `releasedUrls` for the 24-hour wait, `treeOf` for vulnerabilities, `conflictsOf` for Kotlin Multiplatform.
- An ecosystem with no registry is not a dead end: `latestCommand` lets a git command answer, as SwiftPM and GitHub Actions do.
