---
title: The 24-hour wait
description: 'Why Narsil Check never raises a version published less than a day ago, where each registry says when a version came out, and what happens when nobody can say.'
route: check
order: 9
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/npm.ts
  - repo: check
    path: hooks/adapter.ts
  - repo: check
    path: hooks/pypi.ts
  - repo: check
    path: hooks/cargo.ts
  - repo: check
    path: hooks/golang.ts
  - repo: check
    path: hooks/pub.ts
  - repo: check
    path: hooks/nuget.ts
  - repo: check
    path: hooks/rubygems.ts
  - repo: check
    path: hooks/maven.ts
  - repo: check
    path: hooks/swiftpm.ts
  - repo: check
    path: hooks/actions.ts
  - repo: check
    path: hooks/wrapper.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/release-age.test.tsx
  - repo: check
    path: tests/released.ts
  - repo: check
    path: odd/tasks/release-age-all-ecosystems.md
---

## What it does

A version that was published an hour ago has had no time to be tried by anyone. If it is broken, or if it was pushed from a compromised maintainer account, the people who notice first are the ones who installed it first. Registries and maintainers do pull bad releases, but only after someone notices, and that takes time.

Narsil Check gives every release that time. In every ecosystem it reads, a version published less than 24 hours ago does not go up: it lands in the **Bloqueada** (Blocked) group, with the reason under the row in red:

```text
Publicada hace 3 h: Narsil Check espera 24 h antes de subirla
```

That is "Published 3 h ago: Narsil Check waits 24 h before raising it". The README gives the same reason in its own words: a version "que todavía nadie ha probado o que puede venir de una cuenta comprometida" ("that nobody has tried yet, or that may come from a compromised account") does not enter the project by itself.

Nothing else changes for you. The row still shows the jump, the **Actualizar las N** ("Update the N") button leaves it out, and the next scan after the day has passed moves it back to its normal group.

## How it works inside

The wait has four parts: where each registry keeps the date, what counts as proof when there is no date, how a pnpm project's own rule is read, and how the install itself is held to the same day.

### Where the date comes from

Each adapter names the address where its registry answers "when was this version published", and how to read the date from the answer. They are two optional fields of the contract in `hooks/adapter.ts`:

- `releasedUrls(name, version)`: the addresses to try, in order.
- `releasedOf(text, headers)`: the date an answer gives, from its body or from its lower-cased headers.

What each adapter reads, as the code has it:

| Ecosystem      | Where the date is                                                                            |
| -------------- | -------------------------------------------------------------------------------------------- |
| npm and Expo   | the packument's `time` map; when it does not arrive, `pnpm view <name> time --json` or npm's |
| PyPI           | `/pypi/<name>/<version>/json`: the earliest `upload_time_iso_8601` of the release's files    |
| Go             | the proxy's `/@v/<version>.info`: `Time`                                                     |
| Cargo          | crates.io `/api/v1/crates/<name>/<version>`: `version.created_at`                            |
| Pub            | pub.dev `/api/packages/<name>/versions/<version>`: `published`                               |
| NuGet          | the SemVer 1 registration, then the SemVer 2 one: `published`                                |
| RubyGems       | `/api/v2/rubygems/<name>/versions/<version>.json`: `created_at`                              |
| Maven, Gradle  | the version's POM, on its own repository and on the Gradle Plugin Portal: `Last-Modified`    |
| SwiftPM        | GitHub's release for the tag (`<tag>` or `v<tag>`): `published_at`                           |
| GitHub Actions | the same as SwiftPM, through the action's repository                                         |
| Gradle wrapper | `services.gradle.org/versions/current`: `buildTime`                                          |

Two choices in that table are worth understanding.

**PyPI reads the earliest file.** A release can get more files later (a wheel for a new platform). The comment says why the first one counts: "The earliest file of the release: when it became installable."

**SwiftPM reads the release, not the commit.** The first version read the tag's commit date. The independent verifier recorded in the task log pointed out that a committer date "can be forged", and the fix switched to GitHub's release `published_at`, which GitHub sets itself. The README states it: "Es una fecha que pone GitHub, no la del commit, que el autor podría falsificar" ("It is a date GitHub sets, not the commit's, which the author could forge").

npm is the exception to the contract: its date lookup lives in `hooks/register.tsx` (`npmTimes`), because the host does not hand back a very large packument. The comment names astro's and tailwindcss's, "~10 MB". When the packument does not arrive or lacks the version, the mod asks the package manager instead.

### Asking once, keeping it for good

`releasedAt` in `hooks/register.tsx` asks those addresses with `$.http.fetch` and keeps the answer in `$.store` under `published:<ecosystem>:<name>@<version>` (npm's key has no ecosystem part). A publication date never changes, so it has no timer, unlike the six-hour cache of the latest versions.

Only a valid date is kept. `dateOf` accepts a string that `Date.parse` reads and nothing else, so an error page or an empty field is never stored as a date, and the next scan asks again.

### When nobody can say

Some versions have no readable date: a Swift tag with no GitHub release, a package outside GitHub, a registry that does not answer. The rule the author set (quoted below) is that nothing goes up without proof that it waited. A first version of that rule blocked such versions forever, which raised the obvious question.

The answer is `firstSeen`. The first time the mod meets a version with no date, it writes the current time under `seen:<ecosystem>:<name>@<version>`. A version cannot be younger than the moment it was first seen, so 24 hours after that it has been published for a day at least. Meanwhile the row says:

```text
No pude leer cuándo se publicó y la vi por primera vez hace 3 h: Narsil Check espera 24 h antes de subirla
```

That is "I could not read when it was published and first saw it 3 h ago: Narsil Check waits 24 h before raising it". A stored time later than now is ignored and replaced, so a clock that jumped back does not hold a version for longer.

### The rule itself: `ageConflict`

`ageConflict` in `hooks/npm.ts` turns a date, the current time and a wait in minutes into a reason or nothing. It is a pure function, so the tests can call it with any clock. `RELEASE_AGE` is 1440 minutes, "a day, as pnpm 11's minimumReleaseAge by default", in the code's words.

`youngConflicts` runs it for every upgrade, eight at a time, before the groups are decided. Its reasons join the other blocking reasons of the previous guides, and any reason sends the upgrade to **Bloqueada**, whatever its jump.

### Expo's versions wait too

An Expo upgrade is not one version but a range that `npx expo install --fix` resolves. `expoAgeConflict` takes the newest stable version in the npm times that meets the SDK's range, and checks that one. While it is too young the reason names it, for example "El SDK de Expo pide 17.0.8 (npx expo install --fix). Publicada hace 1 h: …" ("The Expo SDK asks for 17.0.8").

### pnpm's `minimumReleaseAge`

pnpm has its own setting for this, `minimumReleaseAge`, in minutes. The code's comment says what it assumes about it: "pnpm 11 and later wait one day unless pnpm-workspace.yaml or .npmrc says otherwise; pnpm 10 waited for nothing."

`releaseAgeOf` in `hooks/npm.ts` reads it in that order: `minimumReleaseAge:` in `pnpm-workspace.yaml`, then `minimum-release-age` in `.npmrc`, then the pnpm major pinned in `packageManager` (below 11 gives 0), else 1440. `releaseMinutes` in `hooks/register.tsx` does this only when `pnpm-lock.yaml` exists, and reads the files as `HEAD` holds them, with `git show HEAD:<path>`. The README explains why: CI installs from the commit, and a version the panel raised early would make CI's `pnpm install --frozen-lockfile` fail.

Two rules follow from the author's words:

- **The longer wait wins.** A pnpm project with 2880 minutes waits two days, with the reason "pnpm espera 48 h para instalarla (minimumReleaseAge)". A shorter value never lowers the day.
- **No exceptions.** `minimumReleaseAgeExclude` is never read. The comment is short: "the wait has no exceptions here."

### Holding the install as well

Blocking the row only covers the library you raise. Its own dependencies may pull in something published five minutes ago. Where the package manager can refuse that, the button asks it to, through `releaseAgeEnv`:

- **pnpm** runs with `PNPM_CONFIG_MINIMUM_RELEASE_AGE` set to the wait, `PNPM_CONFIG_MINIMUM_RELEASE_AGE_STRICT=true` and an empty exclude list, so a young dependency fails the install instead of being written as an exception.
- **npm** runs with `npm_config_before` a day back, so every range resolves to versions published before then.

When either refuses, `ageRefusal` recognizes the tool's message and the pane says so ("Bloqueada por minimumReleaseAge…", "Bloqueada por la espera de 24 h…"), with nothing updated. The README is honest about the rest: yarn, bun and every other ecosystem have no such switch, so there the wait applies to the library that goes up, not to what it brings.

## Build it with Claude

Ask Claude to block any upgrade whose new version was published less than 24 hours ago. The one idea it must get right is what counts as proof of age: a valid date from the registry, or the time the mod first saw the version, and never nothing.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> In my Claude Code mod `my-panel`, block any upgrade whose new version was published less than 24 hours ago. Write a pure function `ageReason(published, now, minutes, seen)` that returns a reason in words or `undefined`: with a valid date, block while younger than `minutes`; without one, use `seen` (when the mod first saw the version) as the proof, and block when there is neither. For PyPI, read the date from `https://pypi.org/pypi/<name>/<version>/json` as the earliest `upload_time_iso_8601` in `urls`, with `$.http.fetch`. Keep a valid date in `$.store` under `published:pypi:<name>@<version>` for good and never store anything that is not a date. Keep the first-seen time under `seen:pypi:<name>@<version>`. Put a blocked upgrade in a `blocked` group with the reason under its row, and keep it out of the "Update all" button. Test the function with a fixed `now`: one hour old, two days old, no date and no `seen`, no date and `seen` a day ago.

### What to check in Claude's answer

1. With a valid date, the upgrade is blocked while the version is younger than the wait, and the reason under the row says so in words.
2. With no date, the first-seen time is the proof. With neither, the upgrade is blocked: "no date" never means "old enough".
3. Only a value that parses as a date is stored under `published:…`, so an error page is never kept. The first-seen time is kept under `seen:…`.
4. For PyPI, the date is the earliest `upload_time_iso_8601` of the release's files, when it became installable.
5. A blocked upgrade sits in the blocked group, the "Update all" button leaves it out, and the tests use a fixed `now` for the four cases the prompt names.

If a check fails, tell Claude what you see: "a version with no readable date has been blocked for three days".

### How the author asked for it

This feature is recorded in the author's words, in narsil-check's public task log `odd/tasks/release-age-all-ecosystems.md`. The previous guide quotes the same entries for the groups; here they are read for what they say about the wait.

#### Recorded: from pnpm to every ecosystem

Before this task there was already a block for pnpm's `minimumReleaseAge`, and the author had set its rule when fixing it. The task log keeps it as S4, in the author's words:

> "siempre que haya minimumReleaseAge se bloquee la actualizacion automatica y se marque el bloqueo, sin excepcion alguna"

In English: "whenever there is a minimumReleaseAge, block the automatic upgrade and mark the block, with no exception at all." That sentence is the source of two behaviours in the code: an exclusion list never counts, and a date that cannot be read blocks too.

Log entry L1 (2026-11-06) records the request that extended it. The author asked whether the Expo problem also happened with KMP or other languages, then chose:

> "El primero me interesa, deberíamos implementar algo similar para los otros lenguajes, es más seguro"

In English: "I'm interested in the first one; we should implement something similar for the other languages, it is safer." Asked how long to wait, the answer was "24 horas está perfecto" ("24 hours is perfect").

#### What the agent did with it

The rest of the log is the agent's own notes, not the author's words. Entry L2 records how each registry's date was found: one probe per registry, with a real package, before any code. Entry L3 records the check of the npm install: with `npm_config_before` a day back, npm refused an hour-old tailwindcss release and resolved the range to the previous one. Entry L6 records the independent verifier's findings, among them that a SwiftPM committer date "can be forged".

#### Recorded: the correction about missing dates

The same day, the author noticed the cost of "an unreadable date blocks". L7 quotes the question:

> "que pasa si una version siempre trae fecha ilegible? nunca la vamos a actualizar?"

In English: "what happens if a version always comes with an unreadable date? are we never going to update it?" The log records the agent's proposal (wait 24 hours from when the mod first saw the version, keep only valid dates, read SwiftPM's release date instead of the commit's) and the author's answer, "si hazlo asi" ("yes, do it that way"). The design is the agent's; the question and the approval are the author's.

#### Reconstruction from the commit history

From `git log -S releasedUrls` and `git log -S ageConflict` in narsil-check:

- `690c1bb` (2026-11-06) "feat: block upgrades pnpm would refuse under minimumReleaseAge". Its message says `minimumReleaseAgeExclude` entries "are honored".
- `54ac6aa` (2026-11-06) "fix: block every upgrade under pnpm's minimumReleaseAge, with no exceptions". The exclusion list is now ignored, an unreadable date blocks, and dates fall back to `pnpm view` because large packuments "never reached the hooks module".
- `1492ca5` (2026-11-06) "feat: hold every ecosystem's upgrades for 24 hours after release". Every adapter gets `releasedUrls`; SwiftPM still reads the tag's commit.
- `ca13b3c` (2026-11-06) "feat: hold Expo SDK-pinned versions for 24 hours too".
- `8c5f2a3` (2026-11-06) "feat: install npm and pnpm upgrades under the 24-hour wait through the whole tree".
- `54cd243` (2026-11-06) "feat: let a version with no readable date go up a day after it was first seen". The L7 correction, with SwiftPM moved to the release date.
- `40e5723` (2026-11-06) "fix: date Go +incompatible versions at the base path and keep Compose rules to its own line". A verifier finding.
- `7048580` (2026-11-09) "feat: check the Gradle wrapper and GitHub Actions for upgrades". Both new adapters come with their dates.

The pattern: the strict rule came first and was right, and the one correction made it strict without being stuck.

## Reference code

This is one correct answer, written for this guide. Read it to understand how the pieces fit together and to compare it with what Claude wrote for you: Claude may choose other names or another order and still be right.

This is a reduced version of the idea, written for this guide and checked against the Claude Code 2.1.325 types (`$.http.fetch`, `$.store.get`, `$.store.set`). It is adapted from `hooks/npm.ts` and `hooks/register.tsx` in [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). It handles PyPI only; another registry is one more URL and one more reader.

```ts
import type { EngineInterface } from 'claude-code'

export const WAIT_MINUTES = 24 * 60

const dateOf = (text: unknown) =>
  typeof text === 'string' && !Number.isNaN(Date.parse(text)) ? text : undefined

// Why a version must wait, or undefined when it is old enough.
export function ageReason(
  published: string | undefined,
  now: number,
  minutes: number,
  seen?: number,
): string | undefined {
  const from = published ? Date.parse(published) : seen
  if (from === undefined || Number.isNaN(from))
    return `No publication date: waiting ${minutes / 60} h`
  const age = Math.floor((now - from) / 60_000)
  if (age >= minutes) return undefined
  const ago = age >= 60 ? `${Math.floor(age / 60)} h` : `${age} min`
  return published ? `Published ${ago} ago` : `No date; first seen ${ago} ago`
}

async function releasedAt($: EngineInterface, name: string, version: string) {
  const key = `published:pypi:${name}@${version}`
  const cached = dateOf(await $.store.get(key))
  if (cached) return cached
  const res = await $.http
    .fetch(`https://pypi.org/pypi/${encodeURIComponent(name)}/${encodeURIComponent(version)}/json`)
    .catch(() => undefined)
  let published: string | undefined
  try {
    const files = res?.ok
      ? ((JSON.parse(res.text) as { urls?: { upload_time_iso_8601?: unknown }[] }).urls ?? [])
      : []
    published = dateOf(
      files
        .map((f) => f.upload_time_iso_8601)
        .filter((t): t is string => typeof t === 'string')
        .sort()[0],
    )
  } catch {
    published = undefined
  }
  if (published) await $.store.set(key, published)
  return published
}

async function firstSeen($: EngineInterface, name: string, version: string, now: number) {
  const key = `seen:pypi:${name}@${version}`
  const seen = await $.store.get(key)
  if (typeof seen === 'number' && seen <= now) return seen
  await $.store.set(key, now)
  return now
}

export async function waitReason($: EngineInterface, name: string, version: string) {
  const now = Date.now()
  const published = await releasedAt($, name, version)
  const seen = published ? undefined : await firstSeen($, name, version, now)
  return ageReason(published, now, WAIT_MINUTES, seen)
}
```

Call `waitReason` for each upgrade during the scan, and treat a returned reason like any other blocking reason. Note that with the first-seen fallback, the "neither" case of `ageReason` only happens if the store cannot be written.

## Common mistakes and how to test it

These come from Narsil Check's code, its task log and its commits:

- **Letting an unknown date through.** "No date" must never mean "old enough". Narsil Check's first pnpm version let large packages through because their dates never arrived.
- **Blocking an unknown date forever.** The opposite mistake, which L7 caught. A first-seen time turns "unknown" into "at least this old".
- **Caching a non-date.** An error page stored as the date would be read back on every scan. Keep only what parses as a date.
- **Trusting a date the publisher writes.** A commit date can be set by whoever made the commit. Prefer a date the registry or host sets.
- **Reading the latest file's time.** On PyPI, the release became installable with its first file.
- **Letting a shorter project setting lower the wait.** Take the longer of your own rule and the project's.
- **Reading the working copy when CI reads the commit.** pnpm's setting is read at `HEAD` for that reason.

To test, `claude plugin test .` runs `tests/release-age.test.tsx`: "each registry says where and when a version was published" calls every adapter's `releasedUrls` and `releasedOf` with the shape of a real answer; "a version whose date cannot be read waits a day from when the mod first saw it" and "the mod's own wait says so, in every ecosystem" call `ageConflict` with a fixed clock. `tests/released.ts` answers every registry's date URL with a year-old date by default, so the other tests are not blocked by accident, and with a recent date for the URLs a test names. The pnpm and npm behaviour is in `tests/upgrade.test.tsx`, for example "npm installs with before set a day back, so a range resolves only to versions a day old, its dependencies included".

## Going further

- The README table does not list the Gradle wrapper (`services.gradle.org`'s `buildTime`) or GitHub Actions (the release, as SwiftPM): both came later, in `7048580`, and only the code shows where their dates come from.
- The task log lists advisories the verifier left open, such as GitHub's unauthenticated limit of 60 requests an hour for SwiftPM's dates. A version whose date cannot be read for that reason falls back to first-seen.
- Twenty-four hours is one constant, `RELEASE_AGE`. A mod for a team with a stricter policy could raise it, and the pnpm rule shows how to honor a longer project setting without letting a shorter one through.
