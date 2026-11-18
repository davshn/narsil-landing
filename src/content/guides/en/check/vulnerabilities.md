---
title: Vulnerabilities with OSV.dev
description: 'How Narsil Check asks OSV.dev about every installed package in one batched query, rates each advisory from its own rating or its CVSS vector, and counts twin advisories once.'
route: check
order: 14
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/osv.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/words.ts
  - repo: check
    path: hooks/adapter.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/vulns.test.tsx
  - repo: check
    path: odd/tasks/vulnerabilities.md
---

## What it does

Each ecosystem has its own audit tool: `npm audit`, `pip-audit`, `cargo-audit`, `govulncheck`. A project with a web front end, a Python service and a Gradle app would need three of them installed, each with its own output. Narsil Check asks one place for all of them.

Under **Actualizaciones** there is a section **Vulnerabilidades**. After every scan it reads the project's installed packages and asks [OSV.dev](https://osv.dev), the open database that gathers the advisories of GitHub, PyPI, Go, crates.io, RubyGems and others. While it works the section says `Buscando vulnerabilidades en OSV.dev…` ("Looking for vulnerabilities in OSV.dev…"). Then:

```text
● ▾ Vulnerabilidades · 3
  3 vulnerabilidades en 2 de 412 paquetes · 1 alta · 2 moderadas
  ● ▾ Alta (1)
    left-pad-ish 1.0.2 · indirecta · GHSA-xxxx-xxxx-xxxx
      Prototype pollution in parse()
      Se corrige en 1.0.3
```

The package and identifier above are illustrative. The summary line reads "3 vulnerabilities in 2 of 412 packages · 1 high · 2 moderate". Findings are grouped by severity, **Crítica**, **Alta**, **Moderada**, **Baja** and **Sin clasificar** ("unrated"), each group folding on its own. Each finding shows the package and version, `indirecta` when you do not declare it yourself, the advisory's identifier, a one-line summary, and the first version that fixes it, or `Sin versión que la corrija` ("No version fixes it").

The section's dot is red for critical or high, yellow for moderate, gray when only low or unrated findings remain, and green when nothing was found. The section opens by itself the first time it finds something. A press on a finding copies it, with its severity, fix and OSV link, ready to paste into an issue.

The upgrade list uses the result too. An upgrade whose new version fixes something says so in its row, `· corrige 2 vulnerabilidades` ("fixes 2 vulnerabilities"), and goes first in its group.

## How it works inside

`hooks/osv.ts` is pure: the request body, reading the answers, the severity, the fixing version, merging twins and the copy text. `hooks/register.tsx` collects the packages, fetches, caches and draws. As in the rest of the mod, the tests check the hard parts without a network.

### Which packages are asked about

`auditedPackages` asks each detected ecosystem's adapter. Where the adapter can read a lockfile (`treeOf`), it gives the whole installed tree: what you declare and what your dependencies pull in. The README lists them: `package-lock.json`, `Cargo.lock`, `uv.lock` or `poetry.lock`, `Gemfile.lock`, `pubspec.lock`, `Package.resolved`, and the `require` lines of `go.mod`, indirect ones included. Where there is no tree to read, as in Maven and NuGet, the declared dependencies are used with their installed or base version.

The full tree matters. Most advisories land on packages nobody declared. A package that is not one of yours gets the `indirecta` mark, so you know an upgrade of something else will be needed.

The Gradle wrapper is left out: OSV has no ecosystem for it, and the code's comment says why that matters, "one unknown name fails the whole batch".

### One batched query

OSV's batch endpoint, `https://api.osv.dev/v1/querybatch`, takes many questions in one POST. `batchBody` builds it:

```json
{
  "queries": [
    { "package": { "name": "left-pad-ish", "ecosystem": "npm" }, "version": "1.0.2" },
    { "package": { "name": "pyyaml", "ecosystem": "PyPI" }, "version": "6.0.1" }
  ]
}
```

Each ecosystem goes by the name OSV uses (`OSV_ECOSYSTEM`): `npm`, `PyPI`, `Go`, `crates.io`, `Pub`, `Maven`, `NuGet`, `RubyGems`, `SwiftURL`, `GitHub Actions`. A Swift package is named by its URL without the scheme, such as `github.com/acme/shop-kit`.

The batch is sent in slices of 500 (`BATCH_SIZE`); the comment notes OSV accepts at most 1,000 per batch. So "one query" means one request for most projects, a few for a very large tree, and never one request per package.

The batch answers, in the same order as the questions, only each advisory's `id` and its `modified` date. The task log recorded that while probing: "the batch returns ids only, details come from /v1/vulns/{id}". So for each package with hits, the mod fetches `https://api.osv.dev/v1/vulns/<id>`, eight packages at a time (`OSV_CONCURRENCY`).

### The advisory cache

Details are kept in `$.store` under `osv:<id>`, with the `modified` date the batch gave. The next audit fetches a detail again only if OSV says it changed. Only the fields the pane reads are kept (identifier, aliases, summary, the first line of the details, severity fields and affected ranges); the comment says why, "the full record can hold pages of details".

### Severity: the advisory's word first, then CVSS

`severityOf` looks first for a rating the advisory states in words: `database_specific.severity`, then the same field or `ecosystem_specific.severity` of each affected package. GitHub's advisories carry `CRITICAL`, `HIGH`, `MODERATE` or `LOW`. `medium` is read as moderate.

Only when there is no such word does it compute a score from the advisory's CVSS vector, a string such as `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H` that describes how an attack works: over the network or locally, how hard, what privileges it needs, whether a user must act, and how much confidentiality, integrity and availability it costs.

`cvss3Score` does not take a score from anywhere: it computes the base score from the vector with the weights and formulas of FIRST's CVSS v3.1 specification, including its rounding rule and the different formulas when the scope changes (`S:C`). Then `severityOfScore` maps it to CVSS's bands: 9.0 and up critical, 7.0 high, 4.0 moderate, above 0 low. The vector above scores 9.8, critical.

Two limits follow from the code:

- Only `CVSS:3.0/` and `CVSS:3.1/` vectors are read. A `CVSS:4.0/` vector is skipped, and an advisory with only that and no word is **Sin clasificar**.
- A 3.0 vector is scored with the 3.1 formulas. The two versions differ mainly in the rounding step, so a score can differ by a tenth in rare cases.

Why the word first? The task log states the assumption: "severity comes from the advisory's own rating … and, failing that, from its CVSS v3 vector's base score". GitHub's rating is what `npm audit` shows, so the two tools agree where they overlap.

### The version that fixes it

An advisory lists affected ranges as events: `introduced`, `fixed`, and others. `fixedFor` collects every `fixed` version for this package (matching names the way the ecosystem does: PyPI ignores case and treats `-`, `_` and `.` alike, NuGet ignores case), keeps the ones above the installed version, and takes the lowest. That is the smallest upgrade that closes it.

### Twins: GHSA and PYSEC

The same Python issue often exists twice in OSV: once as a GitHub advisory (`GHSA-…`) and once in the PyPA database (`PYSEC-…`), each listing the other in its `aliases`. Counting both would double the number.

`mergeVulns` sorts a package's advisories with GHSA first, then walks them. An advisory whose id or aliases meet the id or aliases of one already kept is a twin: it is dropped, but it fills in what the kept one lacks, the severity if that was unrated and the fixing version if there was none. The comment says why GHSA wins: "the GHSA kept for its rating".

This is also why the README notes that the count is of advisories, not of packages. `npm audit` also counts every package that only depends on a vulnerable one; here they are not repeated.

### What is sent to OSV.dev, in plain words

Two kinds of request leave your machine, both through `$.http.fetch`, which the 2.1.325 types describe as fetching "through the host (never the plugin's own network)":

- **The batch**, a POST to `api.osv.dev/v1/querybatch` with, for each package, its name, its ecosystem and its version. That is the whole body.
- **The details**, a GET to `api.osv.dev/v1/vulns/<id>` for each advisory the batch named and the cache does not hold.

No file content, no path, no repository name and no code is sent. But a list of names and versions is not nothing:

- It describes your stack, down to the transitive packages and their exact versions.
- The names can be private. An internal npm package `@acme/billing-core`, a Go module `git.acme.example/shop/api` or a Swift package `github.com/acme/private-kit` reveals a name you may not publish. OSV will not know it, but the name has left the machine.
- Like any web request, OSV sees the address it comes from.

For most projects that is an acceptable trade for one free source of advisories. For a project whose dependency names are themselves confidential, a mod could skip names that match a private scope, or let the person turn the audit off.

### When it runs

`runAudit` runs after every scan, in the background so the list shows first, and on its own button **Consultar de nuevo** ("Check again"), on **Reintentar** after an error, and with `/narsil-check vulns`. One audit runs at a time. An HTTP error from the batch shows `No pude consultar OSV.dev: OSV respondió <status>` ("I could not query OSV.dev").

### README, task log and code

The README and the task log say "nueve ecosistemas" ("nine ecosystems"). The code asks about ten names, every adapter but the Gradle wrapper. The commit that added the audit (`912478b`) says "Each severity copies its own list"; that was replaced in `b3ad055` by copying one finding per press, which is what the code does now.

## Build it with Claude

Ask Claude for a section that sends the installed packages to OSV.dev and groups what comes back by severity. The one idea it must get right is that the work happens in a few batched requests, and that the severity and the fixing version come from each advisory itself.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> In my Claude Code mod `my-panel`, add a Vulnerabilities section for npm projects. Read every installed package and version from `package-lock.json` (its `packages` entries), mark the ones not in `package.json` as indirect, and send them to `https://api.osv.dev/v1/querybatch` with `$.http.fetch`, as `{ queries: [{ package: { name, ecosystem: "npm" }, version }] }`, in slices of 500. For each id the batch returns, fetch `/v1/vulns/<id>` and cache it in `$.store` under `osv:<id>` with its `modified` date, fetching again only when that changes. Rate each advisory from `database_specific.severity` first; if absent, compute the CVSS v3.1 base score from its vector and use the bands 9, 7, 4. Merge advisories that alias each other, keeping the GHSA one. Show the lowest `fixed` version above the installed one. Group by severity, worst first. Test the CVSS function against a few known vectors and their published scores, and the batch with a stubbed `http.fetch`.

### What to check in Claude's answer

1. The packages come from the lockfile, the whole installed tree, and the ones you do not declare are marked indirect.
2. They go to `https://api.osv.dev/v1/querybatch` in slices of 500, never one request per package.
3. Each detail is fetched from `/v1/vulns/<id>` and cached in `$.store` under `osv:<id>` with its `modified` date, and fetched again only when that date changes.
4. Severity is the advisory's own word first. Only without one is the CVSS v3 base score computed and mapped to the bands 9, 7 and 4.
5. Advisories that alias each other (GHSA and PYSEC) count once, with the GHSA one kept, and the fix shown is the lowest `fixed` version above the installed one.

If a check fails, tell Claude what you see: "the same Python issue shows twice, once with a GHSA id and once with a PYSEC id".

### How the author asked for it

This one is recorded. `odd/tasks/vulnerabilities.md` in narsil-check quotes the author's words in its spec S1 and its log entry L1 (2026-11-05). Guide 1 of this path quotes the same two messages for the pane's design; here they matter for where the data comes from.

#### Recorded: the request

S1 quotes the first message:

> "podemos checkear vulnerabilidades de la misma forma? es decir crear un sub menu de vulnerabilidades que haga pnpm audit o similar?"

In English: can we check vulnerabilities the same way, that is, create a vulnerabilities submenu that runs pnpm audit or similar?

The author asked for "pnpm audit or similar". The task log records that the agent proposed something else, and the author accepted it with "si" ("yes"). In the agent's words in the same spec: "OSV.dev instead of each ecosystem's audit tool; the full tree from the lockfile where one is read, direct dependencies elsewhere". That is the decision this guide explains: one database instead of nine tools, most of which were not installed on the machine.

#### Recorded in the task log: the assumption and the probes

These are the agent's notes, not the author's words. The spec's assumption:

> "Assumption: severity comes from the advisory's own rating (GitHub's CRITICAL, HIGH, MODERATE, LOW) and, failing that, from its CVSS v3 vector's base score; a finding with neither is "sin clasificar". Advisories that are the same issue under two ids (GHSA and PYSEC) count once."

Log entry L2 records the probes that shaped the code: one batch answered npm, PyPI, Go, Maven, NuGet and crates.io together; the batch returns ids only; Swift packages are `SwiftURL` named `github.com/owner/repo`; and on the machine only npm and pnpm had audit tools, "no pip-audit, cargo-audit or govulncheck". L3 records that on a real project OSV found the same advisories `npm audit` reports, which `npm audit` spreads over more packages "because it also names the packages that only depend on them".

#### Reconstruction from the commit history

From `git log -- hooks/osv.ts` in narsil-check:

- `912478b` (2026-11-04) "feat: check known vulnerabilities with OSV.dev in a collapsible section". The whole feature in one commit: the batch, the CVSS score, the merge, the fixing version and the upgrade marks.
- `b3ad055` (2026-11-06) "feat: fold upgrade and vulnerability groups, copy a row on click, …". Severity groups fold on their own; one press copies one finding.
- `7048580` (2026-11-09) "feat: check the Gradle wrapper and GitHub Actions for upgrades". Its message: "OSV is not asked about it", for the wrapper.

## Reference code

This is one correct answer, written for this guide. Read it to understand how the pieces fit together and to compare it with what Claude wrote for you: Claude may choose other names or another order and still be right.

This is a reduced version of the idea, written for this guide and checked against the Claude Code 2.1.325 types (`$.http.fetch`). It is adapted from `hooks/osv.ts` and `auditProject` in `hooks/register.tsx` in [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). It leaves out the CVSS computation and the cache.

```ts
import type { EngineInterface } from 'claude-code'

type Pkg = { name: string; version: string; ecosystem: 'npm' | 'PyPI' }
type Severity = 'critical' | 'high' | 'moderate' | 'low' | 'unknown'
type Vuln = { id: string; aliases: string[]; severity: Severity }

const OSV = 'https://api.osv.dev/v1'

function severityOf(advisory: { database_specific?: { severity?: unknown } }): Severity {
  const word = String(advisory.database_specific?.severity ?? '').toLowerCase()
  if (word === 'critical' || word === 'high' || word === 'low') return word
  if (word === 'moderate' || word === 'medium') return 'moderate'
  return 'unknown' // the real mod computes the CVSS v3 score here
}

// Twins alias each other: keep one, the GHSA first.
function merge(vulns: Vuln[]): Vuln[] {
  const out: Vuln[] = []
  const ghsaFirst = [...vulns].sort(
    (a, b) => Number(b.id.startsWith('GHSA-')) - Number(a.id.startsWith('GHSA-')),
  )
  for (const v of ghsaFirst) {
    const names = new Set([v.id, ...v.aliases])
    const twin = out.find((o) => names.has(o.id) || o.aliases.some((a) => names.has(a)))
    if (!twin) out.push(v)
    else if (twin.severity === 'unknown') twin.severity = v.severity
  }
  return out
}

export async function audit($: EngineInterface, packages: Pkg[]): Promise<Map<Pkg, Vuln[]>> {
  const found = new Map<Pkg, Vuln[]>()
  for (let i = 0; i < packages.length; i += 500) {
    const slice = packages.slice(i, i + 500)
    const res = await $.http.fetch(`${OSV}/querybatch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        queries: slice.map((p) => ({
          package: { name: p.name, ecosystem: p.ecosystem },
          version: p.version,
        })),
      }),
    })
    if (!res.ok) throw new Error(`OSV answered ${res.status}`)
    const results = (JSON.parse(res.text).results ?? []) as { vulns?: { id: string }[] }[]
    for (const [j, r] of results.entries()) {
      const vulns: Vuln[] = []
      for (const { id } of r.vulns ?? []) {
        const detail = await $.http.fetch(`${OSV}/vulns/${encodeURIComponent(id)}`)
        if (!detail.ok) continue
        const a = JSON.parse(detail.text)
        vulns.push({
          id,
          aliases: Array.isArray(a.aliases) ? a.aliases : [],
          severity: severityOf(a),
        })
      }
      if (vulns.length > 0) found.set(slice[j] as Pkg, merge(vulns))
    }
  }
  return found
}
```

Run it after your scan without awaiting it in a hook, keep its result in an atom with a `scanning` state first, and draw one fold per severity from that atom.

## Common mistakes and how to test it

These come from Narsil Check's code and tests:

- **One request per package.** A lockfile has hundreds of packages. Batch them.
- **One unknown ecosystem name in the batch.** It fails the whole batch. Leave out what OSV does not know.
- **Only the declared packages.** Most advisories are on transitive ones. Read the lockfile where there is one.
- **Trusting a stored score.** Advisories often carry only a vector. Compute the score, and test the function against published scores.
- **Counting twins twice.** GHSA and PYSEC alias each other. Merge by aliases.
- **"Fixed in" as the first `fixed` event.** An advisory can have several ranges. Take the lowest fix above what is installed.
- **Fetching every detail every time.** Cache by id and `modified`.
- **Forgetting what the request reveals.** Package names can be private. Say what is sent.

To test, `claude plugin test .` runs `tests/vulns.test.tsx`. "a CVSS v3 vector's base score is FIRST's" checks the formula, "severity is the advisory's own rating, else its CVSS score's band" the order, "the fixing version is the lowest fixed event past the installed one" the fix, and "one issue under a GHSA and a PYSEC id counts once, the GHSA kept" the merge. "OSV's batch is asked by each ecosystem's name and answered in order" checks the body. With `on('http.fetch', ...)` answering OSV, "the vulnerabilities section lists findings in folding severity groups, copies one on a press, and marks the upgrade that fixes them" drives the pane, and "an advisory read before is not fetched again while OSV says it has not changed" counts the detail requests.

## Going further

- Score `CVSS:4.0/` vectors too. Its formula is different and longer; a test against published scores is essential.
- Let the person exclude private scopes from the batch, or turn the audit off for a project.
- OSV also has a `/v1/query` endpoint that returns full advisories for one package. For a handful of packages it saves the second round of requests.
- The next guide changes subject: a to-do list kept per project, out of git.
