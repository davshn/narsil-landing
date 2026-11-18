---
title: Explaining a major version with Haiku
description: 'How Narsil Check asks Haiku how hard a major upgrade is for this project, from the release notes and the lines that import the library, and how it keeps the model from inventing.'
route: check
order: 12
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/explain.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/words.ts
  - repo: check
    path: hooks/adapter.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/upgrade.test.tsx
  - repo: check
    path: odd/tasks/ecosystems-wave-2.md
---

## What it does

A major version says "something may break". It does not say whether it breaks for you. React 19 removed several old APIs; if your project never used them, the upgrade is small. To know, you would open the release notes, then search your code for every place that imports the library, and compare.

Narsil Check does that comparison for every library in the **Versión mayor: revisar cambios** ("Major version: review the changes") group. Under each row, while it works, a dim line says `Analizando con Haiku…` ("Analyzing with Haiku…"). Then it shows a difficulty and one or two sentences:

```text
react 18.2.0 → 19.2.0
  Dificultad media: React 19 quita propTypes; tus 2 imports no los usan, pero revisa las refs de texto.
```

That reads "Medium difficulty: React 19 removes propTypes; your 2 imports do not use them, but check the string refs." The example is the one the tests use. The line is green for `baja` (low), yellow for `media` (medium) and red for `alta` (high).

A press on the row copies the jump with its difficulty and reason, ready to paste into an issue or a prompt. The reason is asked once per jump and kept, so it is there again in the next session at no cost.

## How it works inside

`hooks/explain.ts` holds the plain parts (which releases break, the prompt, reading the answer). `hooks/register.tsx` fetches, runs `git grep` and calls the model. That split lets the tests check the prompt and the parsing as pure functions.

### When it runs

When a scan finishes, `scanProject` shows the list at once and starts `explainMajors` without waiting for it. Only upgrades in the `review` group are read: a major that something blocks is in **Bloqueada** and shows its blocking reasons instead. Two are read at a time (`EXPLAIN_CONCURRENCY`), so a list of twenty majors does not fire twenty model calls together. A row already done or in progress is skipped.

### The first input: release notes of the breaking versions

`breakingVersions(current, latest)` names the releases that break between the two, newest first and at most three: each new major's `x.0.0` (from 16 to 19: `19.0.0`, `18.0.0`, `17.0.0`), or below 1.0.0 each new minor's `0.y.0`. The notes of patch releases in between are left out on purpose: the breaking changes are announced in the release that breaks.

`releaseNotes` then finds the library's GitHub repository. For npm it reads the `repository` field of the installed `node_modules/<name>/package.json`, else of the registry's answer; other ecosystems give it through their adapter (`repoUrlOf`, `infoUrl` or `repoUrlFor`). For each breaking version it tries three tag names on GitHub's releases API, since packages tag differently: `v19.0.0`, `@scope/name@19.0.0` for a monorepo, or the bare `19.0.0`.

Each release's notes are cut to 6,000 characters and all of them to 12,000 (`NOTES_PER_RELEASE`, `NOTES_TOTAL`), with `[…]` where something was cut. The comment says why the per-release cap exists: "so a long upgrade guide still leaves room" for the other releases.

When no release has notes and the package is from npm, the mod reads the package's `CHANGELOG.md` from unpkg and keeps only what is above the heading of the installed version: what changed since. unpkg serves npm packages only, so other ecosystems have no fallback.

### The second input: how the project uses it

`usageOf` runs:

```text
git --no-pager grep -n -I -E <pattern> -- . :!node_modules
```

The pattern comes from the adapter's `importPattern`. For npm it matches `from 'name'`, `from 'name/sub'`, `require('name')` and `import('name')`; Python matches `import` and `from` lines with the module name (`yaml` for PyYAML); each ecosystem has its own. The result is the number of files and at most 40 lines of at most 200 characters, each as `path:line:text`.

`git grep` is used, not a file walk, because it searches only tracked files, skips binaries with `-I`, and is fast on a large repository.

### The exact prompt

The system prompt is `SYSTEM` in `hooks/explain.ts`, quoted as it is in [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). It has not changed since the first commit.

```text
You assess how hard a major dependency upgrade is for one specific project.
You get the release notes of the breaking versions and the lines where the project imports the library.
Answer in Spanish, in exactly this form:
DIFICULTAD: baja|media|alta
RAZÓN: one or two sentences, at most 280 characters, naming the concrete breaking change that affects the imports shown, or saying none of them is touched.
Base the answer only on what you are given. Never invent APIs, versions or changes.
If the release notes are missing, say so in the reason and judge only from how much the project uses the library.
```

It is written in English, with the answer's labels in Spanish because the pane speaks Spanish: `DIFICULTAD: baja|media|alta` is "DIFFICULTY: low|medium|high", and `RAZÓN` is "REASON".

The user message is built by `prompt(u, notes, usage)`, also in `hooks/explain.ts`:

```text
Library: react
Upgrade: 18.2.0 -> 19.2.0

The project imports it in 2 files:
src/App.tsx:1:import { useState } from 'react'
src/main.tsx:2:import React from 'react'

Release notes of the breaking versions:
## v19.0.0
…
```

With no imports found, the lines are replaced by "(no imports found: it may be used through config or a CLI)". With no notes, the last part says "(none found)".

### How it keeps the model from inventing

A model asked "how hard is React 19?" will answer from what it remembers, which may be wrong or older than the release. Four choices in the design work against that:

- **It is given the evidence.** The notes and the import lines are in the message; the model does not have to remember either.
- **It is told to use only that.** "Base the answer only on what you are given. Never invent APIs, versions or changes."
- **It has an honest way out.** With no notes, it must say so and judge from how much the project uses the library, instead of filling the gap.
- **The answer has a fixed form.** `parseReason` accepts a reply only when it has both `DIFICULTAD:` with one of the three words and `RAZÓN:` with text. Anything else is discarded, and the row says "Haiku no dio una razón; revisa las notas de la versión." ("Haiku gave no reason; check the version's notes"). The reason is cut to 400 characters, so a runaway reply cannot fill the pane.

None of this proves the reason is right; it makes it checkable. The pane shows what Haiku concluded and names the breaking change, so you can open the same release notes and check it.

### Calling Haiku: `$.model.complete`

```ts
const reply = await $.model.complete({
  model: 'haiku',
  system: SYSTEM,
  prompt: prompt(u, notes, usage),
  maxTokens: 400,
  timeoutMs: EXPLAIN_MS,
})
const reason = reply.isAnswered ? parseReason(reply.text) : undefined
```

Quoted from `hooks/register.tsx` in [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later), reformatted. `EXPLAIN_MS` is 60 seconds.

The 2.1.325 types describe `$.model.complete` as "one text completion through the session's own API client", with "No tools, no history, no system prompt beyond the CLI's identity block and `request.system`". So Haiku sees only this message, nothing of your conversation. `model` takes an alias such as `haiku`, "resolved and allowlist-checked like a `--model` value". The result never rejects for what the provider did: it says `isAnswered`, or gives a `reason` (`api-error`, `empty-reply`, `aborted`), and the mod treats all of them as "no reason". An exception during the whole step shows "No pude analizar esta actualización." ("I could not analyze this upgrade.").

A good answer is written to `$.store` under `why:<name>@<current>-><latest>` and kept for good: the notes of a published release do not change. A failed one is not kept, so the next scan tries again.

### Cost

The types say an answered request "counts toward the session's cost total, `/cost` and the cost and token metrics", and that "Nothing caps it per call". The mod caps it itself: at most 400 output tokens, and an input of at most 12,000 characters of notes plus 40 short lines. Each jump is asked once, ever, on that machine. A long list of majors costs once; the next sessions read the store.

### Privacy

What leaves your machine, and where:

- **To the model provider** (through the session's own client): the library's name, the two versions, and up to 40 import lines from your code with their file paths. Not the rest of your files.
- **To GitHub's API and unpkg**: the package name and versions, to fetch public notes. The README notes GitHub's unauthenticated limit, 60 requests an hour; when it runs out, the analysis uses the `CHANGELOG.md` or says it found no notes.

Import lines are usually harmless, but they are your code. A mod that reads majors of private packages should keep that in mind.

### README and code

The README says "Si no hay release, se usa el `CHANGELOG.md` del paquete" ("If there is no release, the package's `CHANGELOG.md` is used"), with no limit. In the code, that fallback is npm only, because it goes through unpkg.

## Build it with Claude

Ask Claude to send a major upgrade's release notes and the project's import lines to Haiku, and to show how hard the jump is. The one idea it must get right is that Haiku answers only from the evidence it is given, in a fixed form the mod can check.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> In my Claude Code mod `my-panel`, under each npm library with a major upgrade, show how hard the jump is for this project. For each one, find its GitHub repository from the `repository` field of `node_modules/<name>/package.json`, fetch with `$.http.fetch` the release notes of each new major's `x.0.0` (at most three, tags `v<version>`, `<name>@<version>` or `<version>`), and cut them to 12,000 characters. Find the import lines with `$.process.run(['git', '--no-pager', 'grep', '-n', '-I', '-E', pattern, '--', '.', ':!node_modules'])`, at most 40. Call `$.model.complete` with `model: 'haiku'`, `maxTokens: 400`, a 60-second `timeoutMs`, and a system prompt that asks for exactly `DIFFICULTY: low|medium|high` and `REASON:` in at most 280 characters, based only on what it is given, never inventing APIs, and saying so when the notes are missing. Accept the answer only if both lines parse. Cache it in `$.store` under `why:<name>@<from>-><to>` for good. Show "Analyzing…" while it runs. Test with `on('model.complete', ...)` that the prompt contains the notes and an import line, and that a reply without the form shows a fallback line.

### What to check in Claude's answer

1. The message sent to `$.model.complete` contains the release notes of the breaking versions and the import lines, cut to their limits: 12,000 characters of notes and at most 40 lines.
2. The system prompt tells the model to base the answer only on what it is given, never to invent APIs, and to say so when the notes are missing.
3. A reply is accepted only when both the difficulty line and the reason line parse. Anything else shows a fallback line and is not stored.
4. A good reason is kept in `$.store` under a key with the name and both versions, so the same jump is never asked again. A failed one is asked again on the next scan.
5. The scan does not wait for the reasons: the list shows at once, with "Analyzing…" under each major until its reason arrives.

If a check fails, tell Claude what you see: "Haiku names an API my project never imports, and the prompt has no import lines in it".

### How the author asked for it

The original request for this feature was not recorded: it is already in the first commit, and no public task log covers its creation. One later task log records how it was carried to the other ecosystems, in the agent's words.

#### Recorded in a task log

`odd/tasks/ecosystems-wave-2.md` lists, as spec S5, what had to keep working when the second group of ecosystems was added. This is the agent's spec, not the author's words:

> "Haiku's reason for a major upgrade works for every ecosystem: release notes from the repository each registry records, and the project's imports found with git grep."

The same file's S3 lists "Haiku reasons" among the behaviours that had to stay unchanged.

#### Reconstruction from the commit history

From `git log -- hooks/explain.ts` and `git log -S SYSTEM` in narsil-check:

- `1bf736a` (2026-11-04) "feat: add upgrade panel for npm and Expo projects". Its message describes "majors with Haiku's reading of the release notes against the project's imports". `SYSTEM`, `prompt`, `parseReason`, `breakingVersions` and the `why:` cache are all here, as they are now.
- `a95eb07` (2026-11-04) "refactor: read dependencies through an adapter per ecosystem". Each adapter gets its own `importPattern` and `repoUrlOf`, which is how the reason reaches other ecosystems.
- `c50e830` (2026-11-04) "feat: find manifests anywhere in the tree and read four-part versions". Its message: "infoUrl gives release notes a version's own record", for registries whose latest answer names no repository.
- `b3ad055` (2026-11-06) "feat: fold upgrade and vulnerability groups, copy a row on click, …". A press on a row copies it with Haiku's reason, replacing the copy buttons.

The prompt itself never changed. What grew was where the notes and the usage come from.

## Reference code

This is one correct answer, written for this guide. Read it to understand how the pieces fit together and to compare it with what Claude wrote for you: Claude may choose other names or another order and still be right.

This is a reduced version of the idea, written for this guide and checked against the Claude Code 2.1.325 types (`$.model.complete`, `$.store.get`, `$.store.set`). It is adapted from `hooks/explain.ts` and `hooks/register.tsx` in [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). The notes and the import lines are passed in; fetching them is shown above.

```ts
import type { EngineInterface } from 'claude-code'

export type Reason = { difficulty: 'low' | 'medium' | 'high'; text: string }

const SYSTEM = [
  'You assess how hard a major dependency upgrade is for one specific project.',
  'You get the release notes of the breaking versions and the lines where the project imports the library.',
  'Answer in exactly this form:',
  'DIFFICULTY: low|medium|high',
  'REASON: one or two sentences, at most 280 characters.',
  'Base the answer only on what you are given. Never invent APIs, versions or changes.',
  'If the release notes are missing, say so and judge only from how much the project uses the library.',
].join('\n')

export function parseReason(text: string): Reason | undefined {
  const difficulty = /DIFFICULTY:\s*(low|medium|high)/i.exec(text)?.[1]?.toLowerCase()
  const reason = /REASON:\s*([\s\S]+)/i.exec(text)?.[1]?.trim()
  if (!difficulty || !reason) return undefined
  return {
    difficulty: difficulty as Reason['difficulty'],
    text: reason.replace(/\s+/g, ' ').slice(0, 400),
  }
}

export async function explain(
  $: EngineInterface,
  u: { name: string; current: string; latest: string },
  notes: string,
  lines: string[],
): Promise<Reason | undefined> {
  const key = `why:${u.name}@${u.current}->${u.latest}`
  const stored = (await $.store.get(key)) as Reason | undefined
  if (stored) return stored
  const prompt = [
    `Library: ${u.name}`,
    `Upgrade: ${u.current} -> ${u.latest}`,
    '',
    'Import lines:',
    lines.length > 0 ? lines.join('\n') : '(no imports found)',
    '',
    'Release notes of the breaking versions:',
    notes.trim() || '(none found)',
  ].join('\n')
  const reply = await $.model.complete({
    model: 'haiku',
    system: SYSTEM,
    prompt,
    maxTokens: 400,
    timeoutMs: 60_000,
  })
  const reason = reply.isAnswered ? parseReason(reply.text) : undefined
  if (reason) await $.store.set(key, reason)
  return reason
}
```

Run `explain` from a scan that no hook awaits, keep each result in an atom by key with a `loading` state first, and draw the line under the row from that atom. An `undefined` result is your fallback line, and it is not stored.

## Common mistakes and how to test it

These come from Narsil Check's code and tests:

- **Asking without evidence.** A model with only a name and two versions answers from memory. Send the notes and the usage.
- **No way to say "I don't know".** Without the missing-notes rule, the model fills the gap. Give it the honest answer.
- **Trusting free text.** Parse a fixed form and discard what does not match; cut the length.
- **Asking again every session.** A release's notes do not change; cache the reason for good, and do not cache failures.
- **Awaiting it in the scan.** The list should show at once; the reasons arrive after.
- **Firing every call at once.** Limit concurrency; two is enough for a side pane.
- **Sending too much.** Cap the notes and the lines. It bounds cost and how much of your code leaves the machine.

To test, `claude plugin test .` runs `tests/upgrade.test.tsx`, which answers the model with `on('model.complete', ...)`, so no real request is made. "each major shows the reason Haiku gives from the release notes and the imports, and a press on it copies it" checks that the prompt contains the release body, an import line and "in 2 files", then finds the line "Dificultad media: …" and the copied text. "a major read before is not asked again" puts a reason in the store first and counts the model calls. "Haiku's answer is read as a difficulty and a reason" and "a changelog is cut where the installed version begins" test the pure functions.

## Going further

- The reason is keyed by name and versions, not by ecosystem. Two ecosystems with a package of the same name and the same jump would share it; adding the ecosystem to the key would separate them.
- The reason does not change when your code does. If you start using an API the next major removes, the stored reason will not know. A key that includes a hash of the import lines would ask again when they change.
- The next guide is the other end of the list: the upgrades that need no reading at all, and the button that raises them.
