---
title: "Your PR's CI"
description: "How Narsil Check follows the GitHub Actions steps of the session's pull request with the gh CLI, every 10 seconds while a run goes, and stops when it ends."
route: check
order: 4
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/ci.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/session.ts
  - repo: check
    path: types/index.d.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/ci.test.tsx
  - repo: check
    path: tests/session.test.tsx
---

## What it does

When the session has an open pull request, the **Entorno** section shows a **CI** fold under the Remote Control switch. It follows the GitHub Actions run of the pull request's newest commit, step by step, so you can watch the checks without opening the browser.

The fold's head says how far the CI is at a glance:

| Head                                   | Meaning                                                          |
| -------------------------------------- | ---------------------------------------------------------------- |
| `CI · 2/4 · Typecheck`                 | Running: two of four steps done, `Typecheck` running now.        |
| `CI · pasó`                            | Passed.                                                          |
| `CI · falló`                           | Failed.                                                          |
| `CI · esperando el CI del último push` | Waiting: your branch has a commit that no run has picked up yet. |
| `CI · sin ejecuciones`                 | No runs for this branch.                                         |
| `CI · sin leer`                        | Not read: `gh` could not answer, and the reason shows under it.  |

Unfolded, it lists the steps with a mark in Narsil's colors:

- `✓` green: done.
- `✗` red: failed, cancelled, timed out, waiting for an action or failed to start.
- `◐` yellow: running.
- `○` gray: queued or waiting.
- `–` gray: skipped or neutral.

GitHub's own bookkeeping steps (`Set up job`, `Complete job`, `Post …`) are left out, since they say nothing about the project. With several workflows, each run's name heads its steps; with several jobs, each job shows with its own mark.

While a run goes, the fold asks again every 10 seconds, and it stops asking as soon as the CI ends. The fold stays as you left it: the session start does not reset it, and the code's comment says it keeps how you left it across sessions (the first guide explains what the types say about that). While it is folded, nothing is asked.

## How it works inside

### Which pull request, which repository

The CI fold does not look for a pull request itself. It uses the one the desktop app has bound to the session, read in the previous guides through `$.mcp.call('ccd_pr', 'get_status', { session_id: 'self' })`. `parsePr` in `hooks/session.ts` keeps, for an open pull request, its url, its repository (`prRepo`, owner and name, such as `acme/shop`) and its head branch (`prHead`).

The fold is drawn only when `view.prUrl` is set. So it exists only in the desktop app, where `ccd_pr` exists; the README's table of surfaces says the same.

### Asking `gh`

The pure part lives in `hooks/ci.ts`: it builds the commands and reads their output. The hooks module runs them in `readCi`, in `hooks/register.tsx`.

First, the runs of the branch:

```ts
export function runListArgv(repo: string, branch: string): string[] {
  return [
    'gh',
    'run',
    'list',
    '--repo',
    repo,
    '--branch',
    branch,
    '--json',
    RUN_FIELDS,
    '--limit',
    '20',
  ]
}
```

`RUN_FIELDS` is `'databaseId,headSha,workflowName,status,conclusion'`. `gh` lists the newest first, so `latestRuns` takes the first run's commit (`headSha`) as the newest one, keeps only the runs of that commit, and keeps one per workflow name. Older commits' runs never mix with the current one.

Then, for each of those runs, its jobs and steps:

```ts
export function runViewArgv(repo: string, id: number): string[] {
  return ['gh', 'run', 'view', String(id), '--repo', repo, '--json', 'jobs']
}
```

`jobsOf` reads each job's name, status, conclusion and steps, and drops the bookkeeping steps with one regular expression, `NOISE = /^(Set up job|Complete job|Post .+)$/`.

The CI's states are GitHub's: a `status` (`queued`, `in_progress`, `completed`) and, once completed, a `conclusion`. `markOf` turns that pair into a mark and a color, and the list of failing conclusions (`FAILED`) is the same everywhere: in a step's mark, in the head (`ciLabel`) and in the fold's own mark (`ciMark`).

### `$.process.run`, as the code uses it

The 2.1.325 types describe `$.process.run(argv, init)` as running "a command on the host by its argument vector (no shell)", resolving `{ exitCode, stdout, stderr }` "once it exits, any exit code". The timeout is 30 seconds by default and ten minutes at most; Narsil Check passes `GH_MS`, 30 seconds. It rejects when the command cannot start or is still running at the timeout. The types also mark the whole `process` noun "CLI only".

Two things follow, and the code handles both:

- **A non-zero exit is an answer, not an exception.** `readCi` checks `list.exitCode !== 0` and keeps `gh`'s stderr as the error, or "gh terminó con el código N" ("gh ended with code N") when stderr is empty.
- **A missing `gh` is an exception.** The call rejects, the `catch` around `readCi` keeps the message, and the fold says it.

Because the argument vector has no shell, the repository and branch names go to `gh` as plain arguments: there is nothing to quote or escape.

There is a reason to run `gh` instead of calling GitHub's HTTP API from the mod: `gh` brings the person's own sign-in, so the mod never holds a GitHub token. A comment in `hooks/register.tsx` gives a related reason for running git itself in "Actualizar rama": "The mod runs git itself, so the app asks no permission."

### Waiting for a push

Right after `git push`, GitHub may not have started a run for the new commit, and the list still shows the previous commit's run, perhaps already green. Showing "passed" then would be wrong.

So when the checked-out branch is the pull request's head branch, `readCi` also runs `git rev-parse @{upstream}`. If the upstream commit is not the commit of the runs listed, a newer push has no run yet, and the view is marked `isWaiting`: the head says "esperando el CI del último push" and the mark is yellow.

### Every 10 seconds, and then no more

The polling is `watchCi`, a loop:

```tsx
let ciWatch = 0
async function watchCi($: EngineInterface): Promise<void> {
  const id = ++ciWatch
  let waits = 0
  for (;;) {
    const view = await read($, session)
    if (!view.prUrl || !(await read($, isCiOpen))) return
    await update($, ci, (current) =>
      current.status === 'ready' ? current : { ...current, status: 'loading' },
    )
    let next = await readCi($, view)
    if (id !== ciWatch) return
    // A push no workflow answers (a repository with no CI for it) stops waiting.
    if (next.isWaiting && ++waits > CI_WAIT_POLLS) next = { ...next, isWaiting: false }
    await update($, ci, () => next)
    if (next.error || !(next.isWaiting || isGoing(next.runs))) return
    await $.clock.sleep(CI_POLL_MS)
    if (id !== ciWatch) return
  }
}
```

It is quoted from [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Each line is a rule:

- **No pull request, or the fold closed: stop.** Nothing is asked while you are not looking.
- **Keep the last answer while reloading.** A view that is already `ready` stays as it is during the next read, so the steps do not flicker.
- **One watch at a time.** Each call takes a new `id`. A newer watch (from the next session read, a pull request found late, or the fold opening) makes the old one stop at its next check.
- **A push that nobody answers ends the wait.** `CI_WAIT_POLLS` is 12, so after about two minutes a repository with no workflow for that push stops waiting.
- **Stop on an error, or when nothing is running and nothing is waited for.** `isGoing` is true while any run's status is not `completed`.
- **Otherwise wait `CI_POLL_MS`, 10 seconds, with `$.clock.sleep`.** The types describe it as resolving "after `ms` milliseconds".

The types also offer `$.clock.every(ms, fn)`, which calls `fn` every period until it is cancelled. The loop with `sleep` has a property that fits this case: the next read starts only after the previous one ended, so slow `gh` calls never overlap, and the loop ends by itself on the condition it just read.

The watch is started with `void watchCi($)` after a full session read, after a pull request found late, and when you unfold the fold. It is never awaited by a hook.

### When `gh` is missing or not signed in

Both cases end the same way. The view gets an `error`, the head says `CI · sin leer`, the mark is gray `○`, and the unfolded fold shows in red "No pude leer el CI con gh: …" ("I could not read the CI with gh: …") followed by the reason: the engine's message when `gh` could not start, or `gh`'s own stderr when it ran and refused, as it does when it is not signed in. The loop stops on the error; the next session read or unfolding the fold tries again.

On permissions, the README says only that `gh` must be installed and signed in ("con `gh` instalado y con sesión iniciada"). Neither the README nor the code lists scopes for reading the CI. The README's note about the `workflow` permission is about pushing changes to `.github/workflows` over HTTPS, a different feature.

## Build it with Claude

Ask Claude to follow the GitHub Actions run of the session's pull request with `gh`, step by step. The one idea it must get right is when to ask: only the newest commit's runs, only while the fold is open and a run is going, and one watch at a time.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> In my Claude Code mod `my-panel`, add a "CI" fold for the session's open pull request, whose repository (`acme/shop`) and head branch I already have. Run `gh run list --repo <repo> --branch <branch> --json databaseId,headSha,workflowName,status,conclusion --limit 20` with `$.process.run` (30 s timeout), keep only the runs of the first row's `headSha`, one per workflow, then `gh run view <id> --repo <repo> --json jobs` for each. Hide the steps `Set up job`, `Complete job` and `Post …`. Show each step with ✓ green, ✗ red, ◐ yellow for in progress, ○ gray for queued and – gray for skipped. Treat a non-zero exit as an error with gh's stderr, and a rejection (gh missing) as an error too; show it in the fold. Poll in a loop with `$.clock.sleep(10_000)` only while the fold is open and a run is not completed, and stop otherwise; give each watch an id so a newer one replaces it. Test the parsers as pure functions with synthetic gh JSON, and the loop with `mock.clock`.

### What to check in Claude's answer

1. Only the runs of the first row's `headSha` are kept, one per workflow, so an older commit's runs never mix with the current one.
2. A non-zero exit from `gh` is read as an error with its stderr, and a rejection, when `gh` is missing, also shows as an error in the fold.
3. The loop waits 10 seconds with `$.clock.sleep` between reads, and stops when the fold is closed, when no run is still going, or on an error.
4. Each watch has an id, so a newer watch makes the old one stop, and the watch is started with `void`, never awaited in a hook.
5. The steps `Set up job`, `Complete job` and `Post …` are hidden, and each step shows its mark in its color.

If a check fails, tell Claude what you see: "the fold keeps asking gh every 10 seconds after the run has passed".

### How the author asked for it

The original request for the CI fold was not recorded. None of narsil-check's public task logs (`odd/tasks/*.md`) covers it.

#### Reconstruction from the commit history

From `git log -- hooks/ci.ts`, with the related commits to `hooks/register.tsx` and `hooks/session.ts`:

- `7d91264` (2026-11-07) "feat: add an Auto-fix switch to Entorno for the session's open pull request". The session first learns about its pull request here, through `ccd_pr`.
- `8af1f0e` (2026-11-07) "feat: show the PR's CI step by step in a collapsible fold under Remote Control". The whole of `hooks/ci.ts` arrives in this one commit. Its message: it "Reads the newest commit's GitHub Actions runs on the PR's head branch with gh, lists each job's steps without GitHub's bookkeeping ones, and polls every 10 seconds while a run goes or a push waits for one. The fold keeps its open state across sessions." It also bumps the session atom's `shape` for the new pull request fields.
- `90c40f9` (2026-11-07) "fix: read the session's pull request again when the app binds it after the turn ends". Without it, a pull request opened in a turn showed no CI until the next read.
- `f091e0b` (2026-11-07) "fix: retry only the pull request read and stop the retries when the session ends".

The pattern differs from the earlier guides: the CI fold landed complete in one commit, on top of the pull request plumbing of the day before, and the fixes that followed were about finding the pull request, not about the CI itself.

## Reference code

This is one correct answer, written for this guide. Read it to understand how the pieces fit together and to compare it with what Claude wrote for you: Claude may choose other names or another order and still be right.

This is a reduced version of the idea, written for this guide and checked against the Claude Code 2.1.325 types. It is adapted from `hooks/ci.ts` and `hooks/register.tsx` in [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). It follows one workflow and leaves out the wait for a push.

The state's type, in `types/index.d.ts`:

```ts
export type Step = { name: string; status: string; conclusion: string }
export type Ci = { steps: Step[]; isGoing: boolean; error?: string }

declare module 'claude-code' {
  interface PluginState {
    'my-panel': { ci: Ci }
  }
}
```

The hooks module's part, `hooks/register.tsx`:

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'
import type { Ci, Step } from '../types'

const ci = atom({ plugin: 'my-panel', key: 'ci' } as const, { steps: [], isGoing: false } as Ci)
const NOISE = /^(Set up job|Complete job|Post .+)$/

async function gh($: EngineInterface, argv: string[]): Promise<string> {
  const ran = await $.process.run(['gh', ...argv], { timeoutMs: 30_000 })
  if (ran.exitCode !== 0) throw new Error(ran.stderr.trim() || `gh ended with code ${ran.exitCode}`)
  return ran.stdout
}

async function readCi($: EngineInterface, repo: string, branch: string): Promise<Ci> {
  try {
    const fields = 'databaseId,headSha,status,conclusion'
    const runs = JSON.parse(
      await gh($, [
        'run',
        'list',
        '--repo',
        repo,
        '--branch',
        branch,
        '--json',
        fields,
        '--limit',
        '1',
      ]),
    )
    if (!Array.isArray(runs) || runs.length === 0) return { steps: [], isGoing: false }
    const run = runs[0] as { databaseId: number; status: string }
    const viewed = JSON.parse(
      await gh($, ['run', 'view', String(run.databaseId), '--repo', repo, '--json', 'jobs']),
    )
    const steps: Step[] = (viewed.jobs ?? [])
      .flatMap((job: { steps?: Step[] }) => job.steps ?? [])
      .filter((step: Step) => !NOISE.test(step.name))
    return { steps, isGoing: run.status !== 'completed' }
  } catch (err) {
    return { steps: [], isGoing: false, error: err instanceof Error ? err.message : String(err) }
  }
}

let watch = 0
export async function watchCi($: EngineInterface, repo: string, branch: string): Promise<void> {
  const id = ++watch
  for (;;) {
    const next = await readCi($, repo, branch)
    if (id !== watch) return
    await update($, ci, () => next)
    if (next.error || !next.isGoing) return
    await $.clock.sleep(10_000)
    if (id !== watch) return
  }
}

export const MARK = (s: Step) =>
  s.status !== 'completed'
    ? s.status === 'in_progress'
      ? { mark: '◐', color: '#F5B400' }
      : { mark: '○', color: '#8A90A6' }
    : s.conclusion === 'success'
      ? { mark: '✓', color: '#22B573' }
      : s.conclusion === 'skipped'
        ? { mark: '–', color: '#8A90A6' }
        : { mark: '✗', color: '#F0435A' }
```

Start it with `void watchCi($, 'acme/shop', 'feat/login').catch(() => undefined)` from a hook, never awaited, and draw the steps in the pane's `ui.render` hook with `read($, ci)`, one `Text` per step in its `MARK` color, and the error in red when there is one. The reduced `MARK` treats any completed conclusion other than success or skipped as a failure; Narsil Check's `markOf` names the failing ones (`FAILED`) and shows `neutral` as gray too.

## Common mistakes and how to test it

These come from Narsil Check's code and commits:

- **Mixing commits.** `gh run list` returns runs of several commits. Keep only the newest commit's runs, one per workflow, as `latestRuns` does.
- **Announcing a pass right after a push.** The list may still show the previous commit's green run. Compare the upstream commit with the runs' `headSha`, and give up waiting after a bound (`CI_WAIT_POLLS`), or a repository with no CI for that push waits forever.
- **Treating the exit code as an exception.** `$.process.run` resolves on any exit code. Check `exitCode`, and keep stderr as the reason.
- **Polling forever.** Stop when nothing runs, when the fold is closed and on an error. Narsil Check's loop returns on each of these.
- **Two watches at once.** Every read of the session may start a watch. Give each an id and let the newest win.
- **Awaiting the watch in a hook.** A hook's `$.clock.sleep` spends that hook's budget, as the types say; start the watch with `void`.
- **Showing GitHub's bookkeeping.** `Set up job` and `Post …` steps hide the ones that matter.

To test, `tests/ci.test.tsx` checks the pure functions with synthetic `gh` JSON: "the newest commit's runs, one per workflow, newest first", "a run's steps leave out GitHub's own bookkeeping", "each step shows as done, failed, going, waiting or skipped" and "the fold's line says how far the CI is". `tests/session.test.tsx` tests the fold in the pane: it answers `gh` through an `on('process.run', ...)` hook keyed on the joined argument vector, and moves time with `mock.clock` and `clock.advance(10_000)` in "the CI fold, under Remote Control, shows the PR's run step by step and follows it until it ends". "a CI gh cannot read says why in its fold" answers every command with exit code 1 and expects `CI · sin leer` and the red line.

## Going further

- The **Auto-fix** switch right under the fold (previous guides) turns on the desktop app's own CI monitor for the same pull request, which wakes the session when the CI fails; the fold shows the CI, the switch acts on it.
- `ciLabel` counts done steps across every job and run, and names the step running now, so the head alone is often enough while the fold stays folded.
- The fold reads `gh`'s JSON fields, not its text output, so a change in `gh`'s wording does not break it.
