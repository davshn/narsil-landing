---
title: Kotlin, Gradle and AGP (advanced)
description: 'Why a Kotlin or Android build cannot raise one tool alone, and how Narsil Check blocks Kotlin past its compiler plugins and checks the minimums between Gradle, AGP, Kotlin and Compose.'
route: check
order: 18
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/kmp.ts
  - repo: check
    path: hooks/maven.ts
  - repo: check
    path: hooks/wrapper.ts
  - repo: check
    path: hooks/actions.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/kmp.test.tsx
  - repo: check
    path: tests/wrapper.test.tsx
  - repo: check
    path: tests/actions.test.tsx
  - repo: check
    path: odd/tasks/release-age-all-ecosystems.md
---

## What it does

In most ecosystems a library is a library: you raise it, and if its own API did not change, the project keeps building. An Android or Kotlin Multiplatform (KMP) build is different. Its tools are layered, and each layer is built for a range of the one below.

In plain words, the layers are these:

- **Gradle** is the build tool. The project pins its version in the Gradle wrapper, the small `gradle/wrapper/gradle-wrapper.properties` file that says which Gradle to download.
- **The Android Gradle Plugin (AGP)** teaches Gradle to build Android apps. Each AGP needs at least a certain Gradle.
- **Kotlin** is the language, and its Gradle plugin needs at least a certain AGP and a certain Gradle.
- **Compiler plugins** (KSP, SKIE and others) run inside the Kotlin compiler. Each release is built for specific Kotlin versions, so they have to move with Kotlin.
- **Compose Multiplatform** is the UI framework, and each version needs at least a certain Kotlin, and from 1.7 at least a certain AGP.

So a Kotlin patch, which looks trivial, can stop the build because a compiler plugin does not support it yet. An AGP minor can fail because the wrapper's Gradle is too old. None of this shows in the version numbers. It is the same kind of problem as Expo modules tied to an SDK, which guide 7 described.

Narsil Check knows these links. An upgrade that would break one goes to **Bloqueada** ("Blocked"), whatever its jump, with the reason in words. Two examples from the README:

```text
SKIE 0.10.16 es un plugin del compilador de Kotlin: confirma que soporta Kotlin 2.4.21
AGP 8.13.0 necesita Gradle 8.13 o más; el wrapper usa 8.11.1
```

They read "SKIE 0.10.16 is a Kotlin compiler plugin: confirm it supports Kotlin 2.4.21" and "AGP 8.13.0 needs Gradle 8.13 or later; the wrapper uses 8.11.1".

The Gradle wrapper itself is also listed as something to raise, and so are the GitHub Actions your workflows pin, since a CI is part of the build too.

## How it works inside

All of this is in the Maven adapter, which reads Gradle and Maven projects (guide 6). Its `conflictsOf` joins three checks: `kotlinConflicts` (compiler plugins, in `hooks/maven.ts`), `kmpConflicts` (the cross minimums, in `hooks/kmp.ts`), and `lockConflicts` (Gradle dependency locks). Each returns sentences; any sentence blocks the upgrade. All three are pure functions over the parsed dependencies and the project's files, so the tests feed them a list and a wrapper and read the sentences.

### Compiler plugins that must move with Kotlin

`COMPILER_PLUGINS` in `hooks/maven.ts` lists seven: SKIE, KSP, Mokkery, Realm, Metro, kotlinx-rpc and Anvil. Each is found by its coordinates (`co.touchlab.skie`, `com.google.devtools.ksp`, …) or by its key in the version catalog. The catalog key matters: the comment's example is a `build-logic` module that reads `libs.versions.mokkery` directly, so no coordinate in the build files names Mokkery, yet the project uses it.

When Kotlin goes up and the project declares any of them, the upgrade is blocked:

- **KSP is checked exactly.** A KSP1 version carries the Kotlin it was built for, as in `2.4.20-1.0.30`. If that prefix is not the new Kotlin, the reason is "hace falta un KSP para 2.4.21" ("a KSP for 2.4.21 is needed"). A KSP2 version with no Kotlin in it, such as `2.3.0`, works with any and does not block.
- **The others are asked to be confirmed.** Their versions say nothing about Kotlin, so the mod cannot check them. It blocks and asks you to confirm support.

What counts as Kotlin is `org.jetbrains.kotlin` and its plugins, never `kotlinx` (coroutines and serialization go up on their own).

One plugin is missing from the list on purpose: the Compose compiler. It is published as `org.jetbrains.kotlin.plugin.compose`, so it is part of Kotlin itself, with Kotlin's version. The task log explains the choice: "Compose compiler lockstep with Kotlin left out: separate rows would block each other; catalogs share the kotlin version ref." In a catalog both read the same `kotlin` version, so they are one row and go up together.

### The cross minimums, from the tools' own documentation

`hooks/kmp.ts` holds four tables, each with the address it was copied from and the date it was current. The comment says it plainly: "the tables come from the tools' own documentation, quoted below". The task log records why they are hard-coded: the published Gradle module metadata "states none of these".

**AGP to its minimum Gradle**, from Google's AGP release page, "as of AGP 9.5.0":

| AGP  | Minimum Gradle |
| ---- | -------------- |
| 9.5  | 9.6.0          |
| 9.4  | 9.6.0          |
| 9.3  | 9.5.0          |
| 9.2  | 9.4.1          |
| 9.1  | 9.3.1          |
| 9.0  | 9.1.0          |
| 8.13 | 8.13           |
| 8.12 | 8.13           |
| 8.11 | 8.13           |
| 8.10 | 8.11.1         |
| 8.9  | 8.11.1         |
| 8.8  | 8.10.2         |
| 8.7  | 8.9            |
| 8.6  | 8.7            |
| 8.5  | 8.7            |
| 8.4  | 8.6            |
| 8.3  | 8.4            |
| 8.2  | 8.2            |
| 8.1  | 8.0            |
| 8.0  | 8.0            |

The table goes on for 7.0 to 7.4 in the code.

**Kotlin to its Gradle plugin's minimum AGP and Gradle**, from kotlinlang.org's Gradle page, "as of 2.4.21". Each row applies from that Kotlin version on:

| Kotlin from | Minimum AGP | Minimum Gradle |
| ----------- | ----------- | -------------- |
| 2.4.0       | 8.5.2       | 7.6.3          |
| 2.3.0       | 8.2.2       | 7.6.3          |
| 2.1.0       | 7.3.1       | 7.6.3          |
| 2.0.0       | 7.1.3       | 6.8.3          |

**Compose Multiplatform to its minimum Kotlin and AGP**, from JetBrains' CHANGELOG migration notes and the compatibility page. The Kotlin is the strictest platform's, iOS and web. 1.12 states no new minimum, so it keeps 1.11's:

| Compose Multiplatform | Minimum Kotlin | Minimum AGP |
| --------------------- | -------------- | ----------- |
| 1.6                   | 2.0.0          |             |
| 1.7                   | 2.0.0          | 8.1.0       |
| 1.8                   | 2.1.0          | 8.1.0       |
| 1.9                   | 2.1.0          | 8.1.0       |
| 1.10                  | 2.2.0          | 8.1.0       |
| 1.11                  | 2.3.0          | 8.1.0       |
| 1.12                  | 2.3.0          | 8.1.0       |

**KSP from 2.3.12 needs AGP 8.12.0**, from KSP's releases.

### How the checks read the project

`kmpConflicts` needs three facts:

- **The Gradle the wrapper runs**, read by `gradleVersionOf` from the `distributionUrl` line, `…/gradle-9.6.0-bin.zip`. It looks at the root wrapper and at `android/gradle/wrapper/…`, where a React Native project keeps it.
- **The AGP and the Kotlin in use**: the highest version any declaration of that tool writes.
- **What is going up**, and to which version.

Then, for the upgrade at hand:

- **AGP**: the new version's minor is looked up. If the wrapper's Gradle is below its minimum, blocked. If there is no wrapper to read, blocked too: "no encontré gradle/wrapper/gradle-wrapper.properties para confirmarlo" ("I did not find … to confirm it").
- **Crossing into AGP 9 from 8.x**: AGP 9 builds Kotlin in, and the code adds two rules from Google's migration guide. A module that combines `org.jetbrains.kotlin.multiplatform` with `com.android.library` or `com.android.application` must move to `com.android.kotlin.multiplatform.library`, and kapt does not work (move to KSP, or use `com.android.legacy-kapt`). These fire only when crossing. A project already on 9 has dealt with them; the task log records that a test caught them firing again on such a project.
- **Kotlin**: the first row whose "from" the new Kotlin reaches gives the minimum AGP and Gradle.
- **Compose Multiplatform**: only its own line counts, the Gradle plugin and the `runtime`, `foundation`, `ui`, `animation`, `material`, `components` and `desktop` groups. `org.jetbrains.compose.hot-reload` and `material3.adaptive` version on their own and are not Compose Multiplatform here.
- **KSP**: from 2.3.12, the AGP must be 8.12.0 or later.

### Only minimums, and "past the table" means "confirm"

Two decisions shape what the mod refuses.

**Maximums are not checked.** JetBrains publishes the highest AGP and Gradle each Kotlin is tested with, but going past them is not a failure. The code's comment: "The maximums are what is fully supported, not a failure, so they are not checked." The README adds that Google itself combines versions past them. Blocking on maximums would hold back builds that work.

**A version newer than the table blocks.** AGP 9.6, or Compose Multiplatform 1.13, is not in the tables. Rather than guess, the mod blocks with "es más nuevo que la tabla de Google que conozco (hasta 9.5): confirma qué Gradle necesita" ("is newer than the Google table I know (up to 9.5): confirm which Gradle it needs"). A table copied from documentation ages; the safe reading of an unknown row is "ask".

### The wrapper as its own dependency

`hooks/wrapper.ts` makes the root wrapper an ecosystem of its own, `gradle-wrapper`. Its latest version comes from Gradle's version service, `https://services.gradle.org/versions/current`, which also gives the build time used for the 24-hour wait (guide 9). The bump rewrites only the version in `distributionUrl`; there is nothing to install, since the wrapper downloads the new distribution on its next run.

Two limits come from the code. A wrapper with `distributionSha256Sum` is blocked, since the checksum belongs to one distribution and the mod cannot know the next one; the reason gives the `./gradlew wrapper --gradle-version … --gradle-distribution-sha256-sum <sum>` command. And the wrapper under `android/` is not raised: React Native and Flutter choose it.

This closes a loop with the AGP rule. When AGP is blocked because the wrapper's Gradle is too old, the wrapper itself appears as a trivial upgrade. Reading the code, raising it first and scanning again lets AGP pass its check.

### GitHub Actions in the same commit

The commit that added the wrapper also added `hooks/actions.ts`, an adapter for the `uses:` lines of `.github/workflows/*.yml` and `.github/actions/*/action.yml`. An Android CI pins its setup steps this way, so they age like any dependency.

It reads an action pinned to a whole tag (`@v6.1.0`) or to a commit with its version in a comment (`@<commit> # v6.1.0`). A moving tag like `@v6` already follows its major and is left out. Latest versions come from the action's git tags with `git ls-remote`, keeping only whole versions. For a commit pin, the bump first resolves the new tag's commit, following annotated tags (`^{}`), and if it cannot read one, no workflow is written. The README adds a practical note: pushing changes to `.github/workflows` over HTTPS needs a token with the `workflow` permission.

### README and code

The README, in its section on these tools, says "El wrapper solo se lee: nunca entra en el commit del PR" ("The wrapper is only read: it never enters the PR's commit"). That was written with `1637e94`, when the wrapper was only context for the Maven adapter, and it is still true of that adapter (a test checks it). Since `7048580` the wrapper is also its own ecosystem whose manifest is `gradle-wrapper.properties`. Reading `checkPending` (guide 13), a raised wrapper differs from `HEAD` and would be listed and committed with the rest. No test covers that case either way.

## Build it with Claude

Ask Claude for a pure module that blocks a Gradle upgrade the rest of the build cannot take, with the reason as a sentence. The one idea it must get right is that the checks are minimums from published tables, and a version the tables do not know blocks with "confirm" instead of passing.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> In my Claude Code mod `my-panel`, which lists Gradle upgrades from `gradle/libs.versions.toml`, block the ones the rest of the build cannot take, with the reason as a sentence. Read the wrapper's Gradle from the `distributionUrl` in `gradle/wrapper/gradle-wrapper.properties`. Keep three tables in one pure module, each with the URL of the documentation it comes from and the version it is current to: AGP minor to minimum Gradle (Google's AGP release notes), Kotlin to minimum AGP and Gradle (kotlinlang.org's Gradle configuration page), and Compose Multiplatform minor to minimum Kotlin and AGP (its CHANGELOG). Check only minimums. An AGP or Compose version newer than its table, or AGP with no wrapper, blocks with "confirm". When Kotlin goes up and the project declares KSP, block if KSP's `x.y.z-` prefix is not the new Kotlin; for SKIE, block and ask to confirm. Write a test per rule with a list of dependencies and a wrapper text, including a version past the table.

### What to check in Claude's answer

1. Each table sits beside the URL of the documentation it comes from and the version it is current to.
2. Only minimums are checked: an AGP that needs a newer Gradle than the wrapper's blocks, but going past a published maximum does not.
3. An AGP or Compose Multiplatform version newer than its table, and AGP with no wrapper to read, block with a sentence that asks you to confirm.
4. When Kotlin goes up, KSP blocks only if its `x.y.z-` prefix is not the new Kotlin, and SKIE blocks and asks you to confirm support.
5. There is a test per rule, fed a list of dependencies and a wrapper text, and one of them uses a version past the table.

If a check fails, tell Claude what you see: "AGP 8.13.0 shows as a normal upgrade while my wrapper still uses Gradle 8.11.1".

### How the author asked for it

This one is partly recorded. The compiler-plugin rule predates the public task logs; the cross minimums have the author's words.

#### Recorded: "antes de subir corrijamos KMP"

`odd/tasks/release-age-all-ecosystems.md` in narsil-check records, in its spec S5, what the author said after hearing that Compose Multiplatform and AGP were not covered:

> "antes de subir corrijamos KMP. Compose Multiplatform y el Android Gradle Plugin etc, ademas cuando termines lanza el verificador independiente con todo esto"

In English: before pushing, let's fix KMP. Compose Multiplatform and the Android Gradle Plugin, etc.; and also, when you finish, launch the independent verifier with all of this.

Spec S6 quotes the second half again, "lanza el verificador independiente con todo esto", as its own requirement: one independent check of the whole feature before pushing.

#### Recorded in the task log: how it was found and built

These are the agent's notes, not the author's words. Log entry L4 records the gap that led to the request: "Compose Multiplatform and the Android Gradle Plugin are coupled to Kotlin and Gradle versions like Expo modules to the SDK, and no rule here knows them". L5 (2026-11-06) records the research: the AGP table "matched row by row" against Google's page, the Kotlin minimums from kotlinlang.org, that Compose Multiplatform "has no official per-version table" so its minimums come from its CHANGELOG, and the decision to leave the Compose compiler out.

L6 records what the independent verifier found: two blockers over the whole feature, one of them in these rules. `isCompose` caught `org.jetbrains.compose.hot-reload` and `material3.adaptive`, "which version on their own". Both were fixed in one correction batch.

#### Reconstruction from the commit history

From `git log -- hooks/kmp.ts hooks/wrapper.ts hooks/actions.ts` and `git log -S COMPILER_PLUGINS` in narsil-check:

- `4ea9be0` (2026-11-04) "feat: block upgrades kept on purpose and Kotlin past its compiler plugins". The seven plugins, found by coordinate or catalog key, with KSP checked exactly. Its message names the check it was made on: on a KMP template, "Kotlin 2.4.20 -> 2.4.21 is now blocked by SKIE and Mokkery".
- `1637e94` (2026-11-06) "feat: block Android and KMP upgrades the rest of the build cannot take". The four tables. Its message: "Tables quote Google's and JetBrains' documentation; a version past them waits to be confirmed. The Gradle wrapper is read as context and never committed."
- `40e5723` (2026-11-06) "fix: date Go +incompatible versions at the base path and keep Compose rules to its own line". The verifier's two blockers.
- `7048580` (2026-11-09) "feat: check the Gradle wrapper and GitHub Actions for upgrades". The wrapper as its own ecosystem, blocked with a checksum, and the actions adapter.

## Reference code

This is one correct answer, written for this guide. Read it to understand how the pieces fit together and to compare it with what Claude wrote for you: Claude may choose other names or another order and still be right.

This is a reduced version of the idea, written for this guide. It is plain TypeScript with no mod API; it plugs into an adapter's `conflictsOf` as in guide 6. It is adapted from `hooks/kmp.ts` and `kotlinConflicts` in `hooks/maven.ts` in [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). The tables are cut to a few rows; the values are the ones in `hooks/kmp.ts`.

```ts
type Dep = { name: string; version: string }

// AGP minor -> minimum Gradle (a few rows of Google's table).
const AGP_GRADLE: Record<string, string> = {
  '9.0': '9.1.0',
  '8.13': '8.13',
  '8.12': '8.13',
  '8.11': '8.13',
  '8.10': '8.11.1',
}
// Kotlin from -> minimum AGP and Gradle (kotlinlang.org).
const KOTLIN_MIN = [
  { from: '2.4.0', agp: '8.5.2', gradle: '7.6.3' },
  { from: '2.3.0', agp: '8.2.2', gradle: '7.6.3' },
]

const parts = (v: string) =>
  v
    .split(/[.-]/)
    .slice(0, 3)
    .map((n) => Number.parseInt(n, 10) || 0)
const below = (a: string, b: string) => {
  const [x, y] = [parts(a), parts(b)]
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) < (y[i] ?? 0)
  return false
}

export function gradleOf(wrapper: string): string | undefined {
  return /distributionUrl\s*=.*gradle-(\d+(?:\.\d+){0,2})-(?:bin|all)\.zip/.exec(wrapper)?.[1]
}

const AGP = 'com.android.tools.build:gradle'
const isKotlin = (name: string) => /^org\.jetbrains\.kotlin[.:]/.test(name)
const isKsp = (name: string) => /^com\.google\.devtools\.ksp[.:]/.test(name)

export function conflicts(
  name: string,
  target: string,
  deps: Dep[],
  gradle: string | undefined,
): string[] {
  const out: string[] = []
  const agp = deps.find((d) => d.name === AGP)?.version

  if (name === AGP) {
    const needs = AGP_GRADLE[/^(\d+\.\d+)/.exec(target)?.[1] ?? '']
    if (!needs) out.push(`AGP ${target} is newer than the table: confirm which Gradle it needs`)
    else if (!gradle) out.push(`AGP ${target} needs Gradle ${needs}; no wrapper to confirm it`)
    else if (below(gradle, needs))
      out.push(`AGP ${target} needs Gradle ${needs} or later; the wrapper uses ${gradle}`)
  }

  if (isKotlin(name)) {
    const needs = KOTLIN_MIN.find((k) => !below(target, k.from))
    if (needs && agp && below(agp, needs.agp))
      out.push(`Kotlin ${target} needs AGP ${needs.agp} or later; the project uses ${agp}`)
    if (needs && gradle && below(gradle, needs.gradle))
      out.push(`Kotlin ${target} needs Gradle ${needs.gradle} or later`)
    for (const d of deps.filter((d) => isKsp(d.name))) {
      const builtFor = /^(\d+\.\d+\.\d+)-/.exec(d.version)?.[1]
      if (builtFor && builtFor !== target)
        out.push(`KSP ${d.version} is built for Kotlin ${builtFor}: a KSP for ${target} is needed`)
    }
  }
  return out
}
```

`conflicts('com.android.tools.build:gradle', '8.13.0', deps, '8.11.1')` returns the sentence about Gradle 8.13. Any sentence moves the row to your blocked group.

## Common mistakes and how to test it

These come from Narsil Check's code, tests and task log:

- **Treating a Kotlin patch as trivial.** With a compiler plugin in the build it is not. Check the plugins on every Kotlin jump.
- **Missing a plugin read only through the catalog.** A `build-logic` module may name no coordinate. Look at catalog keys too.
- **Checking maximums.** They are "fully supported", not limits. Blocking on them holds back working builds.
- **Guessing past the table.** An unknown version should ask, not pass.
- **Firing the AGP 9 migration rules on every AGP 9 bump.** They belong to the crossing from 8.x; a test caught exactly that.
- **Matching a group too widely.** `org.jetbrains.compose.*` includes artifacts with their own versions. Name the main line's groups.
- **Tables with no source.** Write the URL and the "as of" version beside each, so the next person knows where to check.
- **Rewriting a checksummed wrapper.** The sum changes with the distribution. Block and give the command.

To test, `claude plugin test .` runs `tests/kmp.test.tsx`: "the Android Gradle Plugin cannot go past what the Gradle wrapper runs", "AGP 9 refuses KMP modules on com.android.library and kapt", "Kotlin cannot go past the AGP and Gradle its Gradle plugin supports at least", "Compose Multiplatform cannot go past the Kotlin and AGP it needs", "KSP from 2.3.12 needs AGP 8.12", "artifacts under org.jetbrains.compose on their own version line are not Compose Multiplatform" and "a wrapper under android/, as a React Native project keeps it, gives the Gradle version too". `tests/wrapper.test.tsx` has "a wrapper that checks a checksum is blocked with the reason, since the sum changes too" and "the vulnerabilities check never asks OSV about the wrapper, which it does not know"; `tests/actions.test.tsx` has "a new tag whose commit cannot be read leaves every workflow as it was and says which".

## Going further

- The tables will age. A small script that fetches Google's and JetBrains' pages and compares them with the tables would say when to update them.
- Detecting the version catalog's shared `kotlin` ref would let the pane say "raise Kotlin and the Compose compiler together" instead of leaving it implicit.
- The android/ wrapper of a React Native project could get an informational line, without a button.

This is the last guide of the path "Your own review panel". Its index lists all seventeen guides, from the side panel to these build tools, if you want to go back to any feature. For the ground every guide stands on, the "Mod fundamentals" guides cover what a mod is made of, the `$` object, how to install, reload, validate and test a mod, the surfaces it runs on, and what Narsil's GPL v3 means when you reuse its code.
