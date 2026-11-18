---
title: Versions pinned on purpose
description: 'How Narsil Check reads a comment such as "# pinned: 3.7 breaks auth" in a manifest and keeps that library out of the upgrade button, with the comment as the reason.'
route: check
order: 10
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/adapter.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/swiftpm.ts
  - repo: check
    path: hooks/npm.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/holds.test.tsx
---

## What it does

Sometimes a version is old on purpose. A library broke something in its next release, a plugin only supports this one, or the team agreed to wait for a migration. The person who decided usually leaves a comment next to the version, and the next person to look at the manifest reads it.

A tool that raises versions should read it too. In Narsil Check, a comment that says the version is kept on purpose sends that library to **Bloqueada** (Blocked), and the comment itself is the reason under the row:

```toml
[versions]
# Fijar 2.4.20 hasta confirmar soporte de SKIE para 2.4.21
kotlin = "2.4.20"
ktor = "3.6.1" # pinned: 3.7 breaks auth
```

This example is from the README. The first comment reads "Pin 2.4.20 until SKIE support for 2.4.21 is confirmed". In the pane, the ktor row gets:

```text
Fijada a propósito: «pinned: 3.7 breaks auth»
```

That is "Pinned on purpose", followed by the comment. The **Actualizar las N** ("Update the N") button never takes a blocked library, so the decision written in the manifest holds until someone removes the comment.

## How it works inside

### The words: `HOLD`

The task brief for this path places the detection in `hooks/words.ts`; in the code it lives in `hooks/adapter.ts`, next to the contract every ecosystem keeps. It is one regular expression:

```ts
const HOLD =
  /\b(pin(ned)?|hold|keep|freeze|frozen|do ?n[o']t (upgrade|update|bump)|fij(ar|ad[oa]|o)|congelad[oa]|no (actualizar|subir))\b/i
```

It is quoted from [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). In English it matches pin, pinned, hold, keep, freeze, frozen, "do not" or "don't" followed by upgrade, update or bump; and in Spanish, fijar, fijado, fijada, fijo ("pin", "pinned"), congelado or congelada ("frozen"), "no actualizar" and "no subir" ("do not update", "do not raise"). It ignores case, and `\b` keeps it to whole words, so "keeper" or "pinch" does not count.

The README lists most of these words but not all: "frozen", "fijo", "no subir" and the "update" and "bump" forms are in the code only.

### Which comment counts: `commentOf` and `holdNote`

`commentOf` finds the comment a line carries: after `#`, `//` or `<!--` (preceded by a space or at the start of the line), with a closing `-->` dropped. Those three cover every manifest the mod reads that allows comments: TOML (`Cargo.toml`, `pyproject.toml`, the Gradle version catalog), `requirements.txt`, `pubspec.yaml`, the `Gemfile`, `go.mod`, Gradle scripts, `Package.swift`, and the XML of `pom.xml` and `.csproj` files.

`holdNote(files, keys, spec)` then looks, in every file the adapter read, for the line that writes this dependency:

1. The line must contain the version as written (`spec`) and mention one of the `keys` as a whole name. The keys are the dependency's name, its display name, and, for a version catalog row, its version key (`kotlin` in `versions.kotlin`).
2. The comment on that line counts.
3. The line above counts only when it is a comment by itself. A trailing comment on the line above belongs to another declaration.

Each rule is there for a reason the tests pin. "Another library's line with the same version is not this one's" (`other = "2.4.20" # keep` does not hold kotlin). A comment with no hold word, such as `# the DI library`, "is only a comment". And the same check works for a Gradle `// do not upgrade: needs JDK 21` and a Gemfile `# hold until the 8.0 migration`.

### Where it joins the scan

`scanGeneric` in `hooks/register.tsx`, the scan every ecosystem except npm goes through, calls it for each upgrade after the registry answers:

```ts
const hold = holdNote(files, [u.name, u.display ?? '', ref ?? ''], u.spec)
u.conflicts = [
  ...(hold ? [`Fijada a propósito: «${hold}»`] : []),
  ...(adapter.conflictsOf?.(u, deps, files) ?? []),
  ...(young.get(u) ?? []),
]
if (u.conflicts.length > 0) u.group = 'blocked'
```

Quoted from [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later), reformatted. The hold reason goes first, before what the ecosystem knows it breaks and the 24-hour wait of the previous guide. Any reason at all makes the upgrade `blocked`, so a pinned patch is as blocked as a pinned major.

The pane then draws it like any blocked row: the reasons joined by `·` in red under the library. A press on the row copies the jump with its reasons, ready to paste into an issue.

### Why npm is left out

`package.json` is JSON, and JSON has no comments. `scanNpm` never calls `holdNote`, and the README says so: the check runs "en cualquier ecosistema cuyo manifest admite comentarios (todos menos npm, cuyo `package.json` no los tiene)" ("in any ecosystem whose manifest allows comments: all but npm, whose `package.json` has none").

What npm does have is a different idea with a similar name. "Versions pinned in the tree" (the previous guide) are exact versions another installed package requires, read from `package-lock.json`, not a person's decision. Writing an exact version in `package.json` (`"1.2.0"` instead of `"^1.2.0"`) is not read as a hold either: the upgrade button still raises it, passing the new version to the package manager with no prefix (`rangeFor` in `hooks/npm.ts`, see guide 12).

One line of the README can confuse here. Its list of details says "Expo, peerDependencies y versiones fijadas se revisan solo en npm" ("Expo, peer dependencies and pinned versions are checked only in npm"). In that line, "pinned versions" means pins in npm's tree, not the comments of this guide, which are checked everywhere except npm.

### Pinned by syntax, not by a comment

Two ecosystems have their own way to say "this exact version", and the mod treats it as a decision too:

- **SwiftPM.** A requirement written with `exact:` in `Package.swift`, or `exactVersion` in an Xcode project, sets `isExact` on the dependency. The SwiftPM adapter's `conflictsOf` then gives "Fijada a la versión exacta 1.2.0: revisa por qué antes de subirla" ("Pinned to the exact version 1.2.0: check why before raising it"). The README's reason: "suele ser una decisión a propósito" ("it is usually a decision on purpose").
- **Gradle.** A library a `gradle.lockfile` holds at another version is blocked, because a build with locking refuses it until the lock is regenerated with `--write-locks`.

### Why a comment, and not a settings file

The code and the commits do not record why the hold lives in the manifest's comments rather than in a list of the mod's own. Reading the design: the comment is already where people write such decisions, it travels with the repository to everyone on the team, and it carries its reason, which is exactly what the blocked row needs to show. A list stored by the mod would live on one machine and say nothing about why. That reasoning is an interpretation, not a recorded decision.

## Build it with Claude

Ask Claude for a pure function that finds a hold comment next to a dependency's version and blocks that upgrade with the comment as its reason. The one idea it must get right is which comment belongs to which dependency.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> In my Claude Code mod `my-panel`, which lists outdated dependencies from `Cargo.toml` and `pyproject.toml`, block any dependency whose version is kept on purpose by a comment. Write a pure function `holdNote(files, keys, spec)`: for every line that contains the version `spec` and mentions one of `keys` as a whole name, read the comment after `#`, `//` or `<!--` on that line, or on the line above only when that line is a comment by itself, and return it when it contains a hold word (pin, pinned, hold, keep, freeze, "do not upgrade", and the Spanish fijar, fijado, congelado, "no actualizar"), matching whole words and ignoring case. Put a held dependency in the `blocked` group with the reason "Pinned on purpose: «comment»", and keep it out of the "Update all" button. Skip `package.json`, which has no comments. Test that a trailing comment on the line above does not count, that another dependency's line with the same version does not count, and that a comment without a hold word does not block.

### What to check in Claude's answer

1. The line must contain the version as written and name the dependency as a whole name, so another library with the same version, or `kotlin` inside `kotlinx`, does not count.
2. A comment on the line above counts only when that line is a comment by itself. A trailing comment on the line above belongs to another declaration.
3. The hold words match whole words and ignore case, and a comment without a hold word, such as `# the DI library`, does not block.
4. A held dependency lands in the blocked group with the comment as its reason, and the "Update all" button never takes it.
5. `package.json` is skipped, since JSON has no comments.

If a check fails, tell Claude what you see: "Kotlin is blocked by a "pin" comment written on the kotlinx-coroutines line".

### How the author asked for it

The original request for this feature was not recorded: no public task log in narsil-check covers it. What follows is a reconstruction.

#### Reconstruction from the commit history

From `git log -S holdNote` and `git log -S lockConflicts` in narsil-check:

- `4ea9be0` (2026-11-04) "feat: block upgrades kept on purpose and Kotlin past its compiler plugins". The whole feature in one commit. Its message: "A comment with a hold word (pin, hold, keep, freeze, do not upgrade, fijar, congelado, no actualizar) on a version's line, or alone on the line above, blocks that upgrade with the comment as its reason." It also renamed the group from "Bloqueada por otras dependencias" ("Blocked by other dependencies") to plain **Bloqueada**, "since a dependency is no longer its only reason". The message names the case it was checked on: a Kotlin Multiplatform template where Kotlin's patch is now blocked by its compiler plugins.
- `7125ffd` (2026-11-09) "fix: stop the upgrade button from breaking builds it cannot check". It adds the two pins by syntax: a Gradle library a `gradle.lockfile` holds, and "a Swift package pinned to an exact version. Neither counts as trivial any more."

The commit pairs the comment check with the Kotlin compiler-plugin rule, and the test file that covers both is `tests/holds.test.tsx`. The two share one idea: some upgrades look trivial by number and are not, and the reason must be shown in words.

## Reference code

This is one correct answer, written for this guide. Read it to understand how the pieces fit together and to compare it with what Claude wrote for you: Claude may choose other names or another order and still be right.

This is a reduced version of the idea, written for this guide. It is plain TypeScript with no mod API, adapted from `hooks/adapter.ts` in [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later).

```ts
const HOLD =
  /\b(pin(ned)?|hold|keep|freeze|frozen|do ?n[o']t (upgrade|update|bump)|fij(ar|ad[oa]|o)|congelad[oa]|no (actualizar|subir))\b/i

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function commentOf(line: string): string | undefined {
  const m = /(?:^|\s)(?:#|\/\/|<!--)\s*(.*?)\s*(?:-->)?\s*$/.exec(line)
  return m?.[1]
}

function mentions(line: string, key: string): boolean {
  return new RegExp(`(^|[^\\w.-])${escape(key)}([^\\w.-]|$)`).test(line)
}

// The comment that holds a dependency, from the files of its manifests.
export function holdNote(
  files: Record<string, string>,
  keys: string[],
  spec: string,
): string | undefined {
  for (const text of Object.values(files)) {
    const lines = text.split(/\r?\n/)
    for (let n = 0; n < lines.length; n++) {
      const line = lines[n] ?? ''
      if (!line.includes(spec) || !keys.some((k) => k && mentions(line, k))) continue
      const above = lines[n - 1] ?? ''
      for (const candidate of [line, /^\s*(#|\/\/|<!--)/.test(above) ? above : '']) {
        const comment = commentOf(candidate)
        if (comment && HOLD.test(comment)) return comment
      }
    }
  }
  return undefined
}

// In the scan, after the registry answered:
// const hold = holdNote(files, [dep.name], dep.spec)
// if (hold) { upgrade.conflicts.push(`Pinned on purpose: «${hold}»`); upgrade.group = 'blocked' }
```

Pass only the files of the ecosystem being scanned. The `mentions` check keeps `kotlin` from matching `kotlinx-coroutines`, because a dot or a dash next to the name means it is part of a longer one.

## Common mistakes and how to test it

These come from Narsil Check's code and tests:

- **Counting a trailing comment on the line above.** In `a = "1.0" # keep` followed by `b = "1.0"`, the comment is `a`'s. Only a comment alone on its line speaks for the next one.
- **Matching the version alone.** Two libraries can share a version string. The line must name the dependency too.
- **Matching part of a name.** `kotlin` inside `kotlinx` is another library; the name must stand alone.
- **Words that are too broad.** `keep` also matches a comment like "keep in sync with the server", which would block that library. That follows from the regex; if your projects use such comments, narrow the list.
- **Looking for comments in JSON.** There are none; do not invent a convention the file cannot carry, or document one clearly if you do.
- **Hiding the reason.** The comment is the most useful thing to show: it is the person's own explanation.

To test, `claude plugin test .` runs `tests/holds.test.tsx`. "a comment with a hold word on the version line, or the line above, keeps it" calls `holdNote` with TOML, Gradle and Gemfile lines, including the cases that must not count. "a version kept by a comment is blocked with that comment" goes through the whole pane with `$.ui.mount`: it finds the text "Fijada a propósito: «keep: 1.11.1 breaks the iOS test runner»" and checks that no **Actualizar** button is drawn.

## Going further

- A hold could carry an end: "pin until 2027-01" could stop blocking after that date. Narsil Check does not do this; the comment holds until someone removes it.
- npm could get a convention of its own, such as a key under a custom field in `package.json`. The mod has none, and the README says plainly that npm is not checked.
- The next guide reads the release notes of a major jump with Haiku, which is often how someone finds the reason to write a hold comment in the first place.
