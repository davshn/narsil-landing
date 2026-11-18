---
title: To-dos
description: 'How Narsil Check keeps a per-project to-do list in an untracked JSON file, keeps it out of git, and never overwrites a damaged list without a copy.'
route: check
order: 15
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/todos.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: README.md
  - repo: check
    path: tests/todos.test.tsx
---

## What it does

While you work on one thing you think of three others: a README to review, an upgrade to try later, a test to add. They go somewhere outside the project, or they are lost. Narsil Check gives each project its own short list, in the pane, at the bottom.

The section is **Pendientes** ("Pending"):

```text
● ▾ Pendientes · 2
  ○ ▾ Raise TypeScript to the next major
       Check moduleResolution first
  ○ Review the README
  [ Nueva tarea (nombre: contenido) ]  Agregar
```

- **Add**: type in the field and press Enter. What comes after the first colon is the content: `Raise TypeScript: check moduleResolution first`. Without a colon, the task has only a name.
- **Read**: a press on a name shows or hides its content. A task without content does not unfold.
- **Finish**: a press on `○` removes the task. No history of finished tasks is kept.

The dot is yellow while something waits and gray when the list is empty. The section opens at the start of a session when the list holds something, and stays folded when it is empty. On the phone there is no text field (the mobile app draws none); there the list is read, tasks are finished with `○`, and new ones are added through Claude, as the next guide shows.

The list belongs to the project, not to the session or the machine's settings. It is a file inside the project, and it never reaches a commit.

## How it works inside

`hooks/todos.ts` holds the plain parts: where the file lives, how it is read and written, how an entry splits at its colon, and the line for git's exclude file. `hooks/register.tsx` reads and writes the file and draws the section.

### Where the list lives

The file is `.atl/narsil-check/pendientes.json`, under the project's root. The root is git's top level (`git rev-parse --show-toplevel`), else the session's folder. Using git's top level means the same list is found from any subfolder you open the session in.

The format is small JSON:

```json
{
  "version": 1,
  "tasks": [
    { "id": "mh3k2a1b4c9z", "name": "Review the README" },
    { "id": "mh3k2f9x0q1w", "name": "Raise TypeScript", "content": "Check moduleResolution first" }
  ]
}
```

The `version` field is written but not read yet; it leaves room to change the format later. Each `id` is the time in base 36 plus four random characters, so two tasks with the same name stay distinct and Claude can name one exactly. The ids above are made up.

Why a file and not `$.store`? The store belongs to the mod on that machine. A file in the project is the project's: you can open it, edit it by hand, back it up, and it moves with the folder. And it lets one project write to another project's list, which the next guide uses.

### Keeping it out of git

The list is personal; a pull request should never carry it. Adding it to `.gitignore` would change a tracked file and put that change in front of everyone. So the mod uses git's local exclude file instead, which works like `.gitignore` but is never committed.

`excludeTodos` asks git where that file is, with `git rev-parse --git-path info/exclude`, rather than assuming `.git/info/exclude`. In a linked worktree `.git` is a file, not a folder, and git answers with the right place. Then `withExclude` adds the line `/.atl/narsil-check/` unless the file already has it (or `.atl/narsil-check` or `.atl/narsil-check/`), keeping a final newline.

This runs on every change, and it is safe to repeat: the line is added once. The README says "La primera vez" ("The first time"), which is what you see, since later runs change nothing.

It is also a side concern. If the exclude file cannot be written, the error is swallowed and the task is still saved. The README says so: "Si ese archivo no se puede escribir, la tarea se guarda igual." A folder that is not a git repository has nothing to exclude from, and the step is skipped.

### Safe writes: one change at a time, on the file as it is now

The list can change from three places: the field in the pane, the `○` button, and Claude's tools. Claude may be adding a task while you finish another. And another session on the same project may have written the file since this one read it.

`changeTodos` handles that with two rules:

1. **One change at a time within the session.** Every change is chained onto a single promise, `todoChain`. A change waits for the previous one to finish, so two writes never interleave.
2. **Read right before writing.** Each change reads the file again, applies its edit (add one, remove one) to what is there now, and writes the whole list back. A task another session saved a minute ago is kept.

The chain survives a failed change: it continues from `run.catch(() => undefined)`, so one error does not block every later save.

What this does not protect, and the README is honest about it: two sessions of the same project writing in the same instant. Then the last write can overwrite the other. The writes are not atomic either: `$.fs.write` replaces the file's whole content, as the types say ("the whole new content"); there is no temporary file and rename. For a short personal list that is a reasonable line to draw.

### A damaged file is never read as empty

Suppose you edit the file by hand and leave a trailing comma. A careless reader would see invalid JSON, treat it as an empty list, and the next change would write a new list over your tasks.

`parseTodoFile` tells the cases apart. An empty or missing file is an empty list. A file that is not JSON gives `{ error: 'no es JSON válido' }` ("is not valid JSON"), and one without a `tasks` array gives `{ error: 'no tiene la lista "tasks"' }` ("has no "tasks" list"). Entries without a name are dropped; the rest is kept.

With an error, two things happen:

- **When reading**, the pane shows the error in red, `.atl/narsil-check/pendientes.json no se puede leer (…). No lo toco: …`, which reads "cannot be read (…). I leave it alone: fix it, or add a task and I will keep a copy of the file before starting a new list". Nothing is written.
- **At the next change**, the damaged text is first copied beside it as `pendientes.danado-<moment>.json` (`danado` is "damaged"), named by the ISO time with `:` and `.` replaced, such as `pendientes.danado-2026-11-17T09-30-00-000Z.json`. Then a new list starts with the change, and the pane shows a yellow note saying where the copy is.

This came from a bug. The fix commit `8dc7904` describes it: "A list file that is not valid JSON was read as empty and overwritten by the next change."

The copy is inside the same excluded folder, so it does not reach git either.

### When it is read

`loadTodos` runs at the start of the session, and again each time you unfold the section, so a change made by another session or by hand shows up when you look. Every change updates the pane's atom directly with the list it just wrote, but only when the change was to this project's list: a task written to another project's list does not replace what this pane shows.

## How it was asked of the AI

The original request for this feature was not recorded. No public task log in narsil-check covers the to-do list. What follows is a reconstruction.

### Reconstruction from the commit history

From `git log -- hooks/todos.ts` in narsil-check:

- `5439638` (2026-11-05) "feat: Pendientes, a per-project task list Claude can read and finish". Its message describes the whole design at once: tasks "in .atl/narsil-check/pendientes.json, kept out of git through .git/info/exclude", the field that adds "nombre: contenido", and "every change rereads the file, so edits during a turn or from another session are kept". Claude's tools and the template command arrive in the same commit.
- `8dc7904` (2026-11-05) "fix: keep a damaged Pendientes list and never let side steps block a save". The same day. Its message lists the corrections: the damaged file is "reported in the pane and to Claude, left untouched, and copied aside" before a new list; "A git exclude file that cannot be written no longer stops the save"; the mobile pane "decides by surface whether to draw the field"; "and the README no longer promises safety for two sessions writing at once".

The second commit is the more instructive one. The first version worked on the happy path. The fix is a list of what can go wrong around a file: it can be broken, a side step can fail, a surface can lack an element, and a promise in the README can be too strong.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> In my Claude Code mod `my-panel`, add a to-do section kept per project in `.atl/my-panel/todos.json` under the git top level (`git rev-parse --show-toplevel`, else the session folder), as `{ "version": 1, "tasks": [{ "id", "name", "content"? }] }`. Draw each task with a `○` button that removes it, a name that toggles its content, and an `Input` that adds `name: content`, split at the first colon; skip the `Input` on the mobile surface. Keep the folder out of git by adding `/.atl/my-panel/` to the file `git rev-parse --git-path info/exclude` names, once, and never let that step stop a save. Run every change through one promise chain, and re-read the file before each write. If the file is not valid JSON or has no `tasks` array, never treat it as empty: show an error, and on the next change copy it to `todos.damaged-<ISO time>.json` before starting a new list. Test a damaged file, an exclude file that cannot be written, and a change made by another writer between two of yours.

## The minimal code

This is a reduced version of the idea, written for this guide and checked against the Claude Code 2.1.325 types (`$.fs.exists`, `$.fs.read`, `$.fs.write`, `$.process.run`). It is adapted from `hooks/todos.ts` and `changeTodos` in `hooks/register.tsx` in [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). It takes the project root as given and leaves out drawing.

```ts
import type { EngineInterface } from 'claude-code'

export type Task = { id: string; name: string; content?: string }

const DIR = '.atl/my-panel'
const FILE = `${DIR}/todos.json`

// A missing or empty file is an empty list; anything else unreadable is an error.
export function parseFile(text: string | undefined): { tasks: Task[] } | { error: string } {
  if (!text?.trim()) return { tasks: [] }
  try {
    const tasks = (JSON.parse(text) as { tasks?: unknown })?.tasks
    if (!Array.isArray(tasks)) return { error: 'no "tasks" list' }
    return {
      tasks: tasks.filter((t): t is Task => typeof t?.name === 'string' && t.name.trim() !== ''),
    }
  } catch {
    return { error: 'not valid JSON' }
  }
}

async function exclude($: EngineInterface, root: string): Promise<void> {
  const ran = await $.process.run(['git', 'rev-parse', '--git-path', 'info/exclude'], { cwd: root })
  if (ran.exitCode !== 0) return
  const rel = ran.stdout.trim().replace(/\\/g, '/')
  const path = /^([A-Za-z]:)?\//.test(rel) ? rel : `${root}/${rel}`
  const text = (await $.fs.exists(path)) ? await $.fs.read(path) : ''
  if (text.split(/\r?\n/).some((l) => l.trim() === `/${DIR}/`)) return
  await $.fs.write(path, `${text}${text === '' || text.endsWith('\n') ? '' : '\n'}/${DIR}/\n`)
}

let chain: Promise<unknown> = Promise.resolve()

export function change(
  $: EngineInterface,
  root: string,
  edit: (tasks: Task[]) => Task[],
): Promise<string | undefined> {
  const run = chain.then(async () => {
    const path = `${root}/${FILE}`
    const text = (await $.fs.exists(path)) ? await $.fs.read(path) : undefined
    const file = parseFile(text)
    let notice: string | undefined
    if ('error' in file) {
      const copy = `${DIR}/todos.damaged-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
      await $.fs.write(`${root}/${copy}`, text ?? '')
      notice = `The list was damaged (${file.error}); a copy is in ${copy}.`
    }
    const tasks = edit('error' in file ? [] : file.tasks)
    await exclude($, root).catch(() => undefined)
    await $.fs.write(path, `${JSON.stringify({ version: 1, tasks }, null, 2)}\n`)
    return notice
  })
  chain = run.catch(() => undefined)
  return run
}
```

Add a task with `change($, root, tasks => [...tasks, task])` and finish one with `change($, root, tasks => tasks.filter(t => t.id !== id))`, then write the new list to your atom so the pane redraws.

## Common mistakes and how to test it

These come from Narsil Check's code and tests:

- **Reading a broken file as empty.** The next save destroys the tasks. Tell "empty" from "unreadable", and copy before replacing.
- **Writing from memory.** A list kept in the pane's state and written back loses what another writer added. Read the file right before each write.
- **Two writes at once.** The field and Claude's tool can fire together. Chain them.
- **Editing `.gitignore`.** It is a shared, tracked file. Use the local exclude file.
- **Assuming `.git` is a folder.** In a worktree it is not. Ask git for the path.
- **Letting a side step block the main one.** The exclude line is nice to have; the save is the point.
- **Drawing an element the surface lacks.** Check that `Input` exists, and decide by surface.

To test, `claude plugin test .` runs `tests/todos.test.tsx`. "the list file is read leniently and an entry splits at its first colon" and "the exclude line is added once, and a template is found by its folder name" test the pure parts. "Pendientes starts folded when empty; a task added in the field is saved, kept out of git, and shown" drives the field and checks the file and the exclude line. "a damaged list is left as it is and said so; the next change keeps a copy of it before starting a new list", "a git exclude file that cannot be written does not stop the task from being saved" and "the mobile app has no text field: an empty list says so, and tasks still finish with ○" cover the corrections of `8dc7904`.

## Going further

- Write through a temporary file and a rename if your list grows into something more valuable.
- Keep finished tasks with a date instead of removing them, and show the last few folded.
- A lock file beside the list would close the gap of two sessions writing in the same instant, at the cost of handling a stale lock.
- The next guide gives Claude its own tools over this list: listing, adding and finishing tasks, and writing to another project's list.
