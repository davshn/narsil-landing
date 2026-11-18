---
title: A branch behind its remote
description: 'How Narsil Check fetches, counts the commits your branch lacks, warns at the top of the pane and brings them in with a git pull -r button.'
route: check
order: 5
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/words.ts
  - repo: check
    path: hooks/git.ts
  - repo: check
    path: types/index.d.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/session.test.tsx
---

## What it does

Working on a branch that someone else also pushes to, it is easy to start a change on top of an old state and only find out at the next push. Narsil Check tells you before that happens.

Every time the pane reviews the project's libraries, it also asks git whether your branch is behind its remote. If it is, a red panel appears at the very top of the pane, above everything else, in bold:

> ⚠ La rama feat/login está 3 commits detrás de su remota: actualízala antes de seguir.

In English: "The branch feat/login is 3 commits behind its remote: update it before you go on." Right under it there is a button, **Actualizar rama** ("Update branch").

The same button also lives at the very bottom of the pane, centered under the last section, so you can pull at any time, warning or not. A press runs `git pull -r` on the checked-out branch. While it runs, the button turns into the dimmed text "Actualizando la rama…" ("Updating the branch…"). When it ends, a line above the bottom button says how it went:

| Line                                            | Meaning                                        |
| ----------------------------------------------- | ---------------------------------------------- |
| `Rama feat/login actualizada: rebase hecho`     | Your local commits were replayed over the new. |
| `Rama feat/login actualizada: ya estaba al día` | Nothing to bring: it was already up to date.   |
| `Rama feat/login actualizada: Fast-forward`     | No local commits: the branch just moved ahead. |
| `No pude actualizar la rama: …` (red)           | Git refused or failed; its own reason follows. |

After a successful pull the pane reviews the libraries again, and the warning goes away.

When there is nothing to say, nothing shows: no remote branch, no network answer, or a detached `HEAD` leave the warning hidden, as the README puts it.

## How it works inside

### Where the code lives

The spec for this path points to `hooks/git.ts`, but that file does not run git. It holds the pure helpers for the upgrade pull request of a later guide (`isMainBranch`, `branchName`, `commitTitle`, `prBody`). The fetch, the count and the pull are in `hooks/register.tsx`, and their words in `hooks/words.ts` (`behindNote`, `pullSummary`, `tail`).

### Two small values

The hooks module keeps two atoms, both typed in `types/index.d.ts`:

- `behind`: `{ status: 'unknown' }` or `{ status: 'checked', branch, count }`. What the last review found.
- `pull`: `idle`, `running`, `done` with a text, or `failed` with a message. How the last press of the button ended.

The pane draws from these two values and nothing else. That split is the usual one in Narsil Check: functions that do the work write an atom, and the `ui.render` hook only reads.

### Counting what is missing

`checkBehind` asks git three questions, each through `$.process.run` with a two-minute timeout (`GIT_MS`):

1. `git branch --show-current`. An empty answer means a detached `HEAD`: there is no branch to compare, so the value stays `unknown`.
2. `git fetch --quiet`. This updates the remote-tracking branches, so the count that follows is about the remote as it is now, not as it was at the last fetch.
3. `git rev-list --count HEAD..@{upstream}`. `HEAD..@{upstream}` means "the commits the upstream has that `HEAD` does not". `--count` turns that into one number.

Only an exit code of 0 and a number that parses give `{ status: 'checked', branch, count }`. A branch with no upstream makes `rev-list` fail, which leaves `unknown`. Any rejection (git missing, a timeout) is caught and also leaves `unknown`. The warning shows only for `checked` with `count > 0`.

One detail the README does not mention: the code does not check the fetch's exit code. If the fetch fails because there is no network but the branch has an upstream, `rev-list` still counts against the remote-tracking branch from the last successful fetch. The count can then be stale, and it can be more than zero. The README's "sin red … no se muestra nada" ("without network … nothing shows") holds when there was never a fetch to compare with, not in every case.

### When it is checked

`checkBehind` is never awaited. `scanProject` starts it with `void checkBehind($).catch(() => undefined)` at its first line, so the count runs alongside the library review. That review runs at session start, on **Revisar de nuevo**, on `/narsil-check upgrade`, after the upgrade button, after the pull request button and after a successful pull. A project with no manifest to scan still gets the check at session start, through a separate `else void checkBehind($)`: the comment says "with nothing to scan, that check still runs".

There is no timer. The pane does not poll the remote; it looks again when you or the pane do something that reviews the project.

### Pulling

`pullBranch` is what both buttons call:

```tsx
async function pullBranch($: EngineInterface): Promise<void> {
  if ((await read($, pull)).status === 'running') return
  await update($, pull, () => ({ status: 'running' }) as Pull)
  const branch = (await read($, session)).branch
  try {
    const ran = await runCommand($, ['git', 'pull', '-r'], PULL_MS)
    const value: Pull =
      ran.exitCode === 0
        ? {
            status: 'done',
            text: `Rama ${branch || 'actual'} actualizada: ${pullSummary(ran.stdout)}`,
          }
        : {
            status: 'failed',
            message:
              tail(ran.stderr || ran.stdout) || `git pull terminó con código ${ran.exitCode}`,
          }
    await update($, pull, () => value)
  } catch (err) {
    await update($, pull, () => ({ status: 'failed', message: errorText(err) }) as Pull)
  }
  void loadSession($, true, false).catch(() => undefined)
  if ((await read($, pull)).status === 'done') void runScan($, true).catch(() => undefined)
}
```

It is quoted from [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Each line is a decision:

- **One pull at a time.** A second press while one runs does nothing, and the button is not drawn meanwhile.
- **Two minutes at most** (`PULL_MS = 120_000`). A pull that downloads a lot can take longer than the 30-second default of `$.process.run`.
- **A non-zero exit is an answer.** The 2.1.325 types say `$.process.run` resolves "once it exits, any exit code" and rejects only "when the command cannot start or is still running then". So a refusal is read from `exitCode`, and `catch` is for git missing or a timeout.
- **The reason is git's own.** `tail` keeps the last four lines of stderr (or stdout when stderr is empty), joined and cut to 400 characters: where git writes its "why". With no output at all, the text is "git pull terminó con código N" ("git pull ended with code N").
- **Then read everything again.** `loadSession` reads the session's branch and folder again. Only a successful pull also rescans the libraries with `isFresh` set, because the pull may have brought other versions in the manifests. That rescan runs `checkBehind` again, which is what hides the warning.

`runCommand` is a small wrapper the upgrade button also uses: with no shell, Windows starts some tools only through their `.cmd` shim, so a command that cannot start is tried again as `<command>.cmd`.

`pullSummary` turns git's output into a few words: "up to date" becomes `ya estaba al día`, "Successfully rebased" becomes `rebase hecho`, "Fast-forward" stays `Fast-forward`, and anything else is git's last line.

### Why `-r`

The history shows the choice was made twice. The first version of the button, in `b3ad055`, ran `git pull --ff-only`. The same day, `7b864b6` changed it to `git pull -r`, "replaying local commits over the remote's".

The commits do not say why. Reading the two options side by side: `--ff-only` refuses as soon as you have one local commit the remote lacks, which is the usual case when you are behind on a shared branch, so the button would fail just when it is needed. A plain `git pull` would create a merge commit for every update. A rebase keeps the history in one line and keeps your commits on top, which matches what the warning asks for: "update it before you go on". This reasoning is an interpretation of the change, not a recorded decision.

### Why the mod runs git itself

A comment in `hooks/register.tsx` says it: "The mod runs git itself, so the app asks no permission." A press on a pane button is already the person's decision; routing it through Claude's Bash tool would ask again. The README says the same: "Lo ejecuta el mod directamente, sin pasar por los permisos de la app" ("The mod runs it directly, without the app's permissions").

Two things come with that, both from the 2.1.325 types. `$.process.run` is marked "CLI only", like the rest of the `process` noun. And "Git runs with repo hooks off", so repository hooks (a `post-merge` or `post-rewrite` hook, for example) do not run on this pull.

### When the button is offered, and when not

The bottom button is always drawn, except while a pull runs. The red panel's button is drawn only with the warning. The code does not look at the working tree before offering it: it does not check for uncommitted changes or a rebase in progress.

That is deliberate in the sense that git already knows those rules. A rebase pull with uncommitted changes in tracked files is refused by git (unless the repository's own configuration, such as `rebase.autoStash`, tells it otherwise), and the pane shows git's reason in red. The README describes it that way: "Si git no puede hacerlo (un conflicto o cambios sin commit), lo dice y muestra el motivo" ("If git cannot do it, a conflict or uncommitted changes, it says so and shows the reason").

A conflict is the case to know about. When the rebase stops on a conflict, git exits with an error and leaves the repository in the middle of the rebase. The pane shows the tail of git's output, and that is all it does: it does not run `git rebase --abort` or anything else. You resolve the conflict and continue, or abort, yourself. Since a failed pull does not rescan, the warning stays with its earlier count until the next review.

## Build it with Claude

Ask Claude for a warning that counts the commits your branch lacks, and a button that brings them in. The one idea it must get right is that "no answer" is not zero: a detached `HEAD`, no upstream or a failed command keep the state `unknown`, and nothing shows.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> In my Claude Code mod `my-panel`, add a "behind its remote" warning to my pane. In a function that is never awaited by a hook, run with `$.process.run` (two-minute timeout) `git branch --show-current`, then `git fetch --quiet`, then `git rev-list --count HEAD..@{upstream}`. Keep the result in an atom typed in `types/index.d.ts`: `unknown` for a detached HEAD, no upstream, a non-zero exit or a rejection, else the branch and the count. Run it at session start. When the count is above zero, draw a red bordered box at the top of the pane saying "Branch X is N commits behind its remote" with a button that runs `git pull -r` (two-minute timeout). Keep the pull's state in a second atom: running, done with a short summary of git's output, or failed with the last lines of stderr. Ignore a second press while one runs. After a successful pull, run the check again. Check every API against the plugin-authoring types and test it with `claude-code/testing`, answering git through an `on('process.run', ...)` hook.

### What to check in Claude's answer

1. The check runs `git fetch --quiet` before `git rev-list --count HEAD..@{upstream}`, so the count is about the remote as it is now.
2. A detached `HEAD`, a branch with no upstream, a non-zero exit or a rejection leave the state `unknown`. The warning shows only for a count above zero.
3. The check starts with `void` from `session.start` and is never awaited, so a slow fetch does not hold the session.
4. The button runs `git pull -r`, not `--ff-only`, with a two-minute timeout, and a second press while a pull runs does nothing.
5. A failed pull shows the last lines of git's stderr in red. Only a successful pull runs the check again, which hides the warning.

If a check fails, tell Claude what you see: "the pull failed and the pane does not say why".

### How the author asked for it

The original request for the warning and the button was not recorded. None of narsil-check's public task logs (`odd/tasks/*.md`) covers this feature.

#### Reconstruction from the commit history

From `git log -S checkBehind`, `git log -S pullBranch` and `git log -S "pull -r"` in narsil-check:

- `b3ad055` (2026-11-06) "feat: fold upgrade and vulnerability groups, copy a row on click, show baby Narsil and pull the branch". Its message: "Actualizar rama, last in the pane, runs git pull --ff-only through the mod, with no permission prompt." The button arrives, at the bottom, with fast-forward only.
- `7b864b6` (2026-11-06) "feat: pull the branch with a rebase". Its message: "Actualizar rama now runs git pull -r, replaying local commits over the remote's, and names a rebase, an up-to-date branch or a fast-forward in its result." The correction along the way: from `--ff-only` to `-r`, and `pullSummary` with its three outcomes.
- `2b91c7d` (2026-11-13) "feat: return to the default branch after the PR and warn when the branch is behind". Its message: "Each review fetches and counts the commits the upstream has that HEAD lacks, and shows a red warning at the top of the pane with its own pull button."

The pattern: a manual button first, its behavior corrected the same day, and a week later the pane learning to say when the button is needed, by putting a second copy of it where the eye lands first.

## Reference code

This is one correct answer, written for this guide. Read it to understand how the pieces fit together and to compare it with what Claude wrote for you: Claude may choose other names or another order and still be right.

This is a reduced version of the idea, written for this guide and checked against the Claude Code 2.1.325 types. It is adapted from `hooks/register.tsx` in [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). It leaves out the session read and the library scan.

The state's type, in `types/index.d.ts`:

```ts
export type Behind = { status: 'unknown' } | { status: 'checked'; branch: string; count: number }
export type Pull =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; text: string }
  | { status: 'failed'; message: string }

declare module 'claude-code' {
  interface PluginState {
    'my-panel': { behind: Behind; pull: Pull }
  }
}
```

The hooks module's part, `hooks/register.tsx`:

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'
import type { Behind, Pull } from '../types'

const behind = atom({ plugin: 'my-panel', key: 'behind' } as const, { status: 'unknown' } as Behind)
const pull = atom({ plugin: 'my-panel', key: 'pull' } as const, { status: 'idle' } as Pull)
const GIT_MS = 120_000

export async function checkBehind($: EngineInterface): Promise<void> {
  let value: Behind = { status: 'unknown' }
  try {
    const run = (argv: string[]) => $.process.run(argv, { timeoutMs: GIT_MS })
    const branch = (await run(['git', 'branch', '--show-current'])).stdout.trim()
    if (branch) {
      await run(['git', 'fetch', '--quiet'])
      const counted = await run(['git', 'rev-list', '--count', 'HEAD..@{upstream}'])
      const count = Number.parseInt(counted.stdout.trim(), 10)
      if (counted.exitCode === 0 && Number.isFinite(count))
        value = { status: 'checked', branch, count }
    }
  } catch {
    // Unknown: nothing shows.
  }
  await update($, behind, () => value)
}

const tail = (text: string) => text.trim().split(/\r?\n/).slice(-4).join(' ').slice(0, 400)

export async function pullBranch($: EngineInterface): Promise<void> {
  if ((await read($, pull)).status === 'running') return
  await update($, pull, () => ({ status: 'running' }) as Pull)
  try {
    const ran = await $.process.run(['git', 'pull', '-r'], { timeoutMs: GIT_MS })
    await update($, pull, () =>
      ran.exitCode === 0
        ? { status: 'done', text: tail(ran.stdout) || 'done' }
        : {
            status: 'failed',
            message: tail(ran.stderr || ran.stdout) || `exit code ${ran.exitCode}`,
          },
    )
  } catch (err) {
    await update($, pull, () => ({ status: 'failed', message: String(err) }) as Pull)
  }
  if ((await read($, pull)).status === 'done') void checkBehind($).catch(() => undefined)
}
```

Start the check from `session.start` with `void checkBehind($).catch(() => undefined)` before `return next(e)`. In the pane's `ui.render` hook, read both atoms with `read($, behind)` and `read($, pull)`. When `behind` is `checked` with a count above zero, draw a `Box` with a red `borderColor`, a bold `Text` with the warning and a `Button` whose `onPress` is `() => pullBranch($)`; while `pull` is `running`, draw a dimmed `Text` in its place. Draw `pull`'s text in green when `done` and its message in red when `failed`.

## Common mistakes and how to test it

These come from Narsil Check's code and commits:

- **Counting before fetching.** Without `git fetch`, `HEAD..@{upstream}` compares with what you fetched last, perhaps days ago. Fetch first.
- **Trusting a failed fetch.** If the fetch fails and you do not check its exit code, the count can be stale. Narsil Check accepts that; a stricter version keeps `unknown` when the fetch does not exit with 0.
- **Treating "no answer" as zero.** A detached `HEAD`, no upstream or no git are not "up to date". Keep a separate `unknown` and show nothing for it.
- **Awaiting git in a hook.** A fetch can take seconds. Start it with `void`, never `await` it in `session.start`.
- **`--ff-only` on a shared branch.** It refuses as soon as you have one local commit, which is the case the warning is for. That is the correction `7b864b6` made.
- **Hiding git's reason.** A pull that fails without saying why leaves the person guessing. Keep the last lines of stderr, where git writes it.
- **Forgetting the rebase in progress.** After a conflict the repository is mid-rebase. Say so in the message, or at least do not rescan as if the pull had worked.
- **Two pulls at once.** Guard the function with the `running` state and hide the button meanwhile.

To test, `tests/session.test.tsx` answers git through an `on('process.run', ...)` hook keyed on the joined argument vector. "a review that finds the branch behind its remote shows a big warning at the top, with the pull at hand" answers `git rev-list --count HEAD..@{upstream}` with `3` and expects the red `behind` box, the exact warning text and the `behind-pull` button. "a branch up to date with its remote, or with none, shows no warning" answers `0`. "\"Actualizar rama\", last in the pane, pulls the checked-out branch with a rebase and says how it went" checks that `branch-pull` is the last button, centered, and that a press leaves "Rama feat/login actualizada: rebase hecho". "a pull that fails says why" expects a line starting "No pude actualizar la rama: ". "the words of each pull that went well" tests `pullSummary` with git's real phrases.

## Going further

- The branch name in the **Entorno** section opens a terminal tab in the session's folder (see the session environment guide), which is where you resolve a conflict the pull left.
- `@{upstream}` can be swapped for `origin/main` to show how far a feature branch is from the default branch, a different question with the same three commands.
- The same `checkBehind` could also count `@{upstream}..HEAD`, the commits you have not pushed yet, and warn about those too.
