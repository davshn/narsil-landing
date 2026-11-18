---
title: Creating the PR
description: 'How Narsil Check turns upgraded manifests into a commit, a chore/upgrade-deps branch and a pull request opened with gh, and then returns you to the main branch.'
route: check
order: 13
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/git.ts
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
    path: odd/tasks/ecosystems-wave-4.md
---

## What it does

After the trivial upgrades are installed, the manifests on disk no longer match the last commit. The work that remains is always the same: a branch, a commit with only the dependency files, a push, a pull request with a readable description, and back to where you were. Narsil Check does those steps with one press.

When a manifest's dependency ranges differ from `HEAD`, the pane shows a line such as:

```text
Sin commit: 2 librerías actualizadas en package.json
```

That reads "Not committed: 2 libraries upgraded in package.json". Under it there is one button, and its label depends on the branch you are on:

- On the main branch: **Crear rama, commit y PR** ("Create branch, commit and PR").
- On any other branch: **Commit y push a &lt;rama&gt;** ("Commit and push to &lt;branch&gt;"). It commits and pushes to that branch, and nothing else. The pull request is yours to manage.

On the main branch the button does four things. It creates `chore/upgrade-deps-2026-11-17` (the day's date), commits the manifests and lockfiles there, opens a pull request against the main branch with `gh`, and switches back to the main branch. The pane then says `PR creado desde la rama chore/upgrade-deps-2026-11-17. Volviste a main.` ("PR created from the branch …. You are back on main.") and a toast carries the PR's address.

It does not matter who changed the manifest. An upgrade made by the pane and one you typed by hand are both detected, because the comparison is with `HEAD`, not with the pane's own memory.

## How it works inside

The texts and small decisions live in `hooks/git.ts`, as pure functions: the branch name, the commit title and body, the PR body, which branch counts as the main one, and how to find the PR's address in `gh`'s output. The steps that run git and gh are in `hooks/register.tsx`, in `checkPending` and `publish`. That split is the same as in the rest of the mod: the tests check the texts without running anything.

### Finding what a PR would hold

`checkPending` runs after every scan. For each ecosystem the project uses, and for each of its manifests, it reads the version in the last commit with `git --no-pager show HEAD:<manifest>` and the version on disk, parses both with the ecosystem's adapter, and compares the dependency ranges (`specChanges` in `hooks/adapter.ts`).

Parsing both sides with the adapter, rather than diffing the text, is a deliberate choice. A change to `scripts` in `package.json` is not a dependency change and does not show as one. A range that went from `^3.22.0` to `^3.25.1` does. It also survives a restart: the pending state is recomputed from git, not kept anywhere.

For each ecosystem with changes, the candidate files are its changed manifests plus its lockfiles, at the root and wherever the tree holds them. Then `git status --porcelain -- <those files>` keeps only the ones git reports as modified. A lockfile the install did not touch is left out.

### Which branch is the main one

`isMainBranch` asks `git symbolic-ref --short refs/remotes/origin/HEAD`, which prints something like `origin/main`. When origin names no default, `main` or `master` count. A repository whose default is `develop` is handled correctly as long as `origin/HEAD` is set.

### The steps on the main branch

`publish` runs each command through a small `step` helper that sets the pane's state to the step's name (the pane shows `Creando la rama…`, "Creating the branch…") and throws with that name if the command fails. In order:

1. `git branch --show-current`. An empty answer means a detached `HEAD`, and the pane stops with "cambia a una rama antes de subir los cambios" ("switch to a branch before pushing the changes").
2. `git rev-parse --verify --quiet refs/heads/chore/upgrade-deps-<day>`. If that branch already exists, `branchName` adds the hour and minute: `chore/upgrade-deps-2026-11-17-1432`.
3. `git switch -c <branch>`.
4. `git add -- <files>`, then `git commit -m <title> -m <body> -- <files>`.
5. `git push -u origin <branch>`.
6. `gh pr create --base <main> --head <branch> --title <title> --body <body>`.
7. `git switch <main>`, then the session and the library list are read again.

The commit title is `chore(deps): upgrade 2 dependencies` (or `1 dependency`), and the body lists each change as `- zod: 3.22.0 -> 3.25.1`. The PR body has a `## Summary` with the manager used and a table of package, from and to, then a `## Test plan` with two unchecked boxes: run the test suite and build the project. The boxes are there because a trivial upgrade still needs a human to run the tests.

`prUrlOf` takes the last line of gh's output that looks like `https://…/pull/<number>`, since gh can print other lines before it.

### Why it commits with a path list

The commit is `git commit ... -- <files>`, with the files named after `--`. With paths given, git commits those files as they are on disk and nothing else, even if you had other files staged. Your work in progress stays out of the PR. The README says it plainly: "El resto de tus cambios sin commit no se incluye" ("The rest of your uncommitted changes is not included").

The other uncommitted changes travel with you: `git switch -c` carries them to the new branch and `git switch <main>` carries them back, because none of them are in the commit and the only files that differ between the two branches are the ones just committed.

### Why it goes back to the main branch

Returning to the main branch was added later (`2b91c7d`). Staying on the upgrade branch left people working on top of a PR branch by accident. Back on the main branch there is a catch the README spells out: the manifests hold the old versions again, while `node_modules` (or its equivalent) may still hold the new ones. So the pane scans again, and the README suggests reinstalling if you keep working there.

If git refuses the switch, the pane does not try to force it. It stays on the new branch and says why: `PR creado desde la rama …. No pude volver a main: <git's error>` ("I could not go back to main").

### What happens when something fails

- **A step fails before the PR exists.** The error names the step: `No pude crear el PR. Subiendo la rama: fatal: no remote` ("I could not create the PR. Pushing the branch: …"). Reading the code, the steps that already ran are not undone: if the push fails, you are on the new branch with the commit made locally.
- **gh is not logged in.** `gh pr create` exits with an error and the pane shows the end of it, after `Creando el PR:`. The branch is already pushed by then.
- **gh is missing.** When a command cannot start at all, `runCommand` tries it once more as `<name>.cmd` (the form Windows installs), then gives up. Reading the code, that failure is a rejection rather than an exit code, so it reaches the pane without the step's name.
- **Both branch names are taken.** Only the day's name is checked. If the name with the time also exists (two runs in the same minute), `git switch -c` fails and the pane says `Creando la rama: …`. A branch of that name that exists only on the remote is not checked; the push would then fail.
- **Two presses.** A press while the job is `running` does nothing.

### Commit hooks do not run

The 2.1.325 types say of `$.process.run`: "Git runs with repo hooks off". The README agrees: hooks such as husky do not run on these commits. A team that relies on a commit hook to lint or sign will see these commits arrive without it.

### README and code

The comment above `publish` still says "A commit of package.json and its lockfile alone", from the time the mod knew only npm. The code commits the manifests and lockfiles of every ecosystem with changes, as the README says.

## How it was asked of the AI

The original request for this feature was not recorded. The button is already in the first commit, and no public task log covers its creation. One later task log mentions it, in the agent's words.

### Recorded in a task log

`odd/tasks/ecosystems-wave-4.md`, which adds Swift packages, lists as spec S2 what had to keep working. This is the agent's spec, not the author's words:

> "Everything the earlier waves built keeps working for SwiftPM: grouping, the bump button, Haiku reasons, copy buttons, the commit/push/PR button and the auto-open rule."

### Reconstruction from the commit history

From `git log -- hooks/git.ts` and `git log -S` over `hooks/register.tsx` in narsil-check:

- `1bf736a` (2026-11-04) "feat: add upgrade panel for npm and Expo projects". Its message ends with "Pending upgrades become a commit and push, or a branch and PR from the default branch." The branch name `chore/upgrade-deps-…`, the path-limited commit and `gh pr create` are already here.
- `a95eb07` (2026-11-04) "refactor: read dependencies through an adapter per ecosystem". The pending changes are read per adapter, by comparing each manifest with `HEAD`, so the button works for every ecosystem added after.
- `2b91c7d` (2026-11-13) "feat: return to the default branch after the PR and warn when the branch is behind". Its message: "After opening the upgrade PR the pane switches back to the base branch and rescans; a refused switch keeps the new branch and says why."

The design did not change much. What changed was where you end up afterwards.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> In my Claude Code mod `my-panel`, add a button that turns the dependency changes of `package.json` into a pull request. First compare the dependency ranges of `git show HEAD:package.json` with the file on disk, and list the changed ones; show the button only when there are some. On press, with `$.process.run` and no shell: stop with a clear message on a detached HEAD; if the current branch is not the default one (from `git symbolic-ref --short refs/remotes/origin/HEAD`, else `main` or `master`), commit and push to it and stop there. On the default branch, create `chore/upgrade-deps-YYYY-MM-DD` (add `-HHMM` if that branch exists), run `git add -- package.json package-lock.json`, `git commit -m "chore(deps): upgrade N dependencies" -m <list> -- package.json package-lock.json`, `git push -u origin <branch>`, and `gh pr create --base <default> --head <branch> --title … --body …` with a table of changes and a test plan. Then `git switch` back and say so; if the switch fails, stay and show git's error. Name the failing step in every error. Ignore a second press while it runs. Test it by answering `process.run` in the tests and checking the exact argv of each command, in order.

## The minimal code

This is a reduced version of the idea, written for this guide and checked against the Claude Code 2.1.325 types (`$.process.run`, `$.ui.toast`). It is adapted from `hooks/git.ts` and `publish` in `hooks/register.tsx` in [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). It handles only the default branch, and takes the files and changes as already found.

```ts
import type { EngineInterface } from 'claude-code'

type Change = { name: string; from: string; to: string }

const pad = (n: number) => String(n).padStart(2, '0')

export function branchName(ms: number, taken: boolean): string {
  const d = new Date(ms)
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return `chore/upgrade-deps-${day}${taken ? `-${pad(d.getHours())}${pad(d.getMinutes())}` : ''}`
}

async function step($: EngineInterface, label: string, argv: string[]): Promise<string> {
  const ran = await $.process.run(argv, { timeoutMs: 60_000 })
  if (ran.exitCode !== 0) throw new Error(`${label}: ${(ran.stderr || ran.stdout).trim()}`)
  return ran.stdout
}

export async function openUpgradePr(
  $: EngineInterface,
  base: string,
  files: string[],
  changes: Change[],
): Promise<string> {
  const title = `chore(deps): upgrade ${changes.length} ${changes.length === 1 ? 'dependency' : 'dependencies'}`
  const body = changes.map((c) => `- ${c.name}: ${c.from} -> ${c.to}`).join('\n')
  const now = Date.now()
  const taken = await $.process.run([
    'git',
    'rev-parse',
    '--verify',
    '--quiet',
    `refs/heads/${branchName(now, false)}`,
  ])
  const branch = branchName(now, taken.exitCode === 0)

  await step($, 'Creating the branch', ['git', 'switch', '-c', branch])
  await step($, 'Staging', ['git', 'add', '--', ...files])
  await step($, 'Committing', ['git', 'commit', '-m', title, '-m', body, '--', ...files])
  await step($, 'Pushing', ['git', 'push', '-u', 'origin', branch])
  const out = await step($, 'Opening the PR', [
    'gh',
    'pr',
    'create',
    '--base',
    base,
    '--head',
    branch,
    '--title',
    title,
    '--body',
    body,
  ])
  const url =
    out
      .split(/\r?\n/)
      .filter((l) => /^https:\/\/\S+\/pull\/\d+$/.test(l.trim()))
      .pop() ?? out.trim()

  const back = await $.process.run(['git', 'switch', base])
  $.ui.toast(
    back.exitCode === 0
      ? `PR opened: ${url}. Back on ${base}.`
      : `PR opened: ${url}. Still on ${branch}.`,
  )
  return url
}
```

Call it from a button's `onPress`, keep a `running` state in an atom so a second press does nothing, and show the error's message, which already names the step, when it throws.

## Common mistakes and how to test it

These come from Narsil Check's code and tests:

- **`git commit -a` or a bare `git commit`.** Either one can take files you never meant to include. Name the files after `--`.
- **Diffing text instead of ranges.** A whitespace change or a new script would offer a PR. Parse both sides with the same reader.
- **Assuming the default branch is `main`.** Ask `origin/HEAD` first.
- **Staying on the upgrade branch.** The next change lands on the PR by accident. Go back, and say so when you cannot.
- **Leaving the pane out of date after switching.** The manifests changed under it. Scan again.
- **Errors without a step.** "exit code 128" helps nobody. Name the step.
- **Counting on commit hooks.** They are off for `$.process.run`; do not assume a hook lints these commits.

The commit itself takes the whole file as it is on disk. If you edited something else in `package.json` by hand, such as a script, that edit goes into the PR too. Check the diff before pressing.

To test, `claude plugin test .` runs `tests/upgrade.test.tsx`, which answers every `process.run` itself and records the argv. "the PR button makes a branch, commits package.json and the lock, pushes and opens a PR" checks the order of the commands, the exact `git add -- package.json package-lock.json`, the commit title and the `gh pr create --base main --head <branch>`, and that `git switch main` comes after gh. "on a work branch the button commits and pushes to it, with no new branch or PR", "a PR that is made but cannot go back to the default branch says so and stays on the new branch" and "a failed push says which step failed" cover the other paths. "the branch is named by day, and by time when the day is taken" and "the PR address is the URL gh prints" test the pure functions.

## Going further

- The PR body could carry the vulnerabilities each upgrade fixes, which the pane already knows (the next guide).
- `gh pr create` accepts `--label` and `--reviewer`. A team setting for those is a small addition.
- A remote branch of the same name is not checked. `git ls-remote --heads origin <branch>` before the push would catch it.
- The next guide leaves upgrades for security: the known vulnerabilities of the packages you have installed.
