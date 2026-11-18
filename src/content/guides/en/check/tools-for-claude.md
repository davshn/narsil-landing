---
title: Tools for Claude
description: 'How Narsil Check gives Claude four tools over the to-do list with $.tool.register, serves them from tool.call hooks, and how the model decides when to use them.'
route: check
order: 16
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/todos.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/todos.test.tsx
---

## What it does

The to-do list of the last guide is useful from the pane. It is more useful if you can also tell Claude "note in the to-dos that the login test is flaky" in the middle of a task, or "do the README task", and Claude finds it, does it, and crosses it off.

Narsil Check gives Claude four tools for that:

| Tool                   | What it does                                                                    |
| ---------------------- | ------------------------------------------------------------------------------- |
| `todo_list`            | Lists this project's tasks: id, name and content of each.                       |
| `todo_add`             | Adds a task with a name and optional content.                                   |
| `todo_done`            | Removes a finished task, named by its id or its exact name.                     |
| `todo_add_to_template` | Adds a task to another project's list, usually the template this one came from. |

Claude sees them as `mcp__narsil-check__todo_list` and so on. A task Claude adds appears in the pane at once, and a task you add in the pane is in the next `todo_list`. They share one list and one writer.

The fourth tool has its own command. When you do something in a project that the template it came from should also get, such as a tricky upgrade, you say:

```text
/narsil-check template "in acme-template create the task of raising TypeScript to the next major, explain what we had to do"
```

Claude finds the template's folder beside this project, writes the explanation (it knows how the work was done; the pane does not), and adds the task there. If it finds no folder, or several that look alike, it asks you which one.

## How it works inside

### Two halves: declaring and serving

A mod's tool has two parts, and the 2.1.325 types describe both under `$.tool.register`:

- **Declaring it**: `$.tool.register({ name, description, inputSchema })` "Declares a tool the model can call from the next prompt on". It returns the full name, `mcp__<plugin>__<name>`.
- **Serving it**: "Serve it with a `tool.call` hook on `{ tool: "mcp__<plugin>__<name>" }` that returns the result (a call no hook answers fails)".

So the mod declares four tools in `registerTools`, and adds four `on('tool.call', { tool: … }, …)` hooks that answer them. The types add that registration "Rejects until the session binds, at `session.start`", which is why `registerTools` is called from the `session.start` hook. It is not awaited there, and its failure is caught: if the tools cannot be registered, the rest of the pane still works.

### The declarations

The names come from constants in `hooks/todos.ts`. The descriptions and schemas are in `hooks/register.tsx`, quoted here from [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later):

```ts
await $.tool.register({
  name: TOOL_LIST,
  description:
    "List this project's pending tasks (the Narsil Check pane's Pendientes): id, name and content of each.",
})
await $.tool.register({
  name: TOOL_ADD,
  description:
    "Add a task to this project's Pendientes list in the Narsil Check pane. Use it when the user asks to note something to do later.",
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Short task name' },
      content: { type: 'string', description: 'Optional details' },
    },
    required: ['name'],
  },
})
await $.tool.register({
  name: TOOL_DONE,
  description:
    "Remove a finished task from this project's Pendientes list. Call it when you complete a task that is on the list.",
  inputSchema: {
    type: 'object',
    properties: { task: { type: 'string', description: 'The task id, or its exact name' } },
    required: ['task'],
  },
})
```

Reformatted. `todo_list` has no `inputSchema`; the types say it defaults to `{ type: "object" }`, a call with no arguments. `todo_add_to_template` takes `template` ("Folder name beside this project, or absolute path"), `name` and `content` ("What to do and how it was done here: changes, files, problems and fixes"), with `template` and `name` required. Its description names an example template folder, `backendTemplate`.

### Serving a call

Each hook reads the arguments from the event itself: the types describe `tool.call`'s input as carrying its own keys "beside the tool's own arguments", so `todo_add`'s `name` is `e.name`. The hook checks them, does the work through the same functions the pane uses (`addTodo`, `finishTodo`, `readTodoFile`), and answers with one of two shapes:

- `{ result: text }`: the tool's output, which the model reads.
- `{ deny: text }`: in the types' words, "Refuses the call: the model receives the text as an error result".

The mod's comment records a trap: "An MCP-style { content, isError } object is refused by the engine." The answer is `result` or `deny`, nothing else.

The answers are short English sentences the model can act on:

- `todo_add`: `Added [mh3k2a1b4c9z] Review the README.`
- `todo_done` with an unknown task: `No pending task "readme". Call todo_list to see them.`, as an error.
- `todo_list` on an empty list: `No pending tasks.`

Every hook runs inside `answered`, which turns any thrown error (a file that cannot be read or written) into `{ deny: 'The Pendientes list could not be changed: …' }`. Without it, a failed write would be a failed tool call with no explanation. With it, Claude reads why and can tell you.

When the change met a damaged list (the previous guide), the answer carries the pane's note after `Note for the user:`, so Claude passes it on. `todo_list` on a damaged file refuses with "cannot be read (…). Tell the user; a change will keep a copy of it and start a new list."

### Why give the model tools at all

Claude could already edit `.atl/narsil-check/pendientes.json` with its file tools. It would usually work, and it would skip everything the last guide built: the chain that serializes changes, the re-read before writing, the copy of a damaged file, the exclude line. It could also write a shape the reader rejects.

A tool makes the list's rules the only way in. Claude does not need to know the format, the path or the safety rules; it says "add this" and the mod does it the same way the pane does. The result is also verifiable: the tool's text says what changed, with the id.

There is a second reason, specific to the template tool: it reaches another folder. `templateDir` resolves a name to a folder beside this project, matching without regard to case, dashes, underscores or spaces, exactly first and by containment otherwise. It refuses with a question when there are none or several: "Several folders in … match "…": a, b. Ask the user which one." A rule like that is much easier to keep in code than in a prompt.

### How Claude decides to use them

The model chooses a tool from what it reads about it. Three things shape that choice here.

**The description says when, not only what.** `todo_add` ends with "Use it when the user asks to note something to do later". `todo_done` says "Call it when you complete a task that is on the list". That second sentence is what makes Claude cross a task off by itself when it finishes the work, as the README promises: "la tacha él mismo al terminarla" ("it crosses it off itself when it finishes").

**The tools wait behind ToolSearch.** The mod passes no `isDeferred`. The types say that left out, "the engine's rule places it: behind ToolSearch, as it places an MCP server's tool". The model sees the tool's name in a list of deferred tools, and loads the full schema only when it searches for it. So the four tools cost almost no context until they are needed. The mod's comment says it directly, "behind ToolSearch, so they cost nothing until used", and the README: "No las lee en cada mensaje, así que no gastan contexto hasta que las usa" ("It does not read them on every message, so they spend no context until it uses them"). The trade is one search step the first time. Names like `todo_add` in a server named `narsil-check` make that search easy.

**The command names the tool.** `/narsil-check template "…"` does not call the tool itself. It submits a prompt with `$.prompt.submit`, built by `templatePrompt`, that says which tool to use (`mcp__narsil-check__todo_add_to_template`), that the template is a folder name beside this project or an absolute path, to put in the content what was changed, in which files, what failed and how it was solved, and to ask if the tool cannot find the template. The person's request goes in quoted. The mod hands over the part only Claude can do, the explanation, and keeps the part code does better, finding the folder and writing the file.

None of this forces a call. The model may still answer without the tool, or ask first. The descriptions make the right call the obvious one.

## How it was asked of the AI

The original request for these tools was not recorded. No public task log in narsil-check covers the to-do list or its tools. What follows is a reconstruction.

### Reconstruction from the commit history

From `git log -S tool.register` over `hooks/register.tsx` and `git log -- hooks/todos.ts` in narsil-check:

- `5439638` (2026-11-05) "feat: Pendientes, a per-project task list Claude can read and finish". The only commit that adds `$.tool.register`. Its message: "Claude gets todo_list, todo_add and todo_done, and /narsil-check template "…" asks Claude to add a task, with how the work was done, to a template's list through todo_add_to_template." The list and the tools were built together, so the pane and Claude shared a writer from the start.
- `8dc7904` (2026-11-05) "fix: keep a damaged Pendientes list and never let side steps block a save". For the tools: "Claude's tools return a readable error on any file failure". This is where `answered` comes from.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> In my Claude Code mod `my-panel`, give Claude tools over the to-do list I already keep in `.atl/my-panel/todos.json`. In `session.start`, without awaiting it and catching its failure, call `$.tool.register` three times: `todo_list` (no input), `todo_add` (`name` required, `content` optional) and `todo_done` (`task`, an id or exact name). Write each description to say when to use it: "Use it when the user asks to note something to do later", "Call it when you complete a task that is on the list". Leave `isDeferred` out. Serve each with `on('tool.call', { tool: 'mcp__my-panel__todo_add' }, …)`, reading the arguments from the event, and go through the same change function the pane uses. Answer `{ result: text }` with a short sentence that includes the task id, or `{ deny: text }` for a bad input or any thrown error, never an MCP-style `{ content, isError }`. Test each tool by calling it with `$.tool.call` and checking the file and the text.

## The minimal code

This is a reduced version of the idea, written for this guide and checked against the Claude Code 2.1.325 types (`$.tool.register`, `on('tool.call', { tool }, …)`, the `result` and `deny` answers). It is adapted from `registerTools` and the `tool.call` hooks in `hooks/register.tsx` in [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). `change` and `Task` are the ones from the previous guide's code, assumed in `./todos`.

```ts
import type { EngineInterface, Register } from 'claude-code'
import { change, type Task } from './todos'

const PLUGIN = 'my-panel'

type Answer = { result: string } | { deny: string }

async function answered(fn: () => Promise<Answer>): Promise<Answer> {
  try {
    return await fn()
  } catch (err) {
    return {
      deny: `The list could not be changed: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

async function registerTools($: EngineInterface): Promise<void> {
  await $.tool.register({
    name: 'todo_add',
    description:
      "Add a task to this project's to-do list. Use it when the user asks to note something to do later.",
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Short task name' } },
      required: ['name'],
    },
  })
  await $.tool.register({
    name: 'todo_done',
    description:
      "Remove a finished task from this project's to-do list. Call it when you complete a task that is on the list.",
    inputSchema: {
      type: 'object',
      properties: { task: { type: 'string', description: 'The task id, or its exact name' } },
      required: ['task'],
    },
  })
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    void registerTools($).catch(() => undefined)
    return next(e)
  })

  on('tool.call', { tool: `mcp__${PLUGIN}__todo_add` }, async ($, e) =>
    answered(async () => {
      const name = (e as unknown as { name?: unknown }).name
      if (typeof name !== 'string' || !name.trim()) return { deny: 'A task needs a name.' }
      const task: Task = { id: Date.now().toString(36), name: name.trim() }
      await change($, await $.session.cwd(), (tasks) => [...tasks, task])
      return { result: `Added [${task.id}] ${task.name}.` }
    }),
  )

  on('tool.call', { tool: `mcp__${PLUGIN}__todo_done` }, async ($, e) =>
    answered(async () => {
      const ref = String((e as unknown as { task?: unknown }).task ?? '').trim()
      let removed: Task | undefined
      await change($, await $.session.cwd(), (tasks) => {
        removed =
          tasks.find((t) => t.id === ref) ??
          tasks.find((t) => t.name.toLowerCase() === ref.toLowerCase())
        return tasks.filter((t) => t !== removed)
      })
      return removed
        ? { result: `Removed [${removed.id}] ${removed.name}.` }
        : { deny: `No task "${ref}".` }
    }),
  )
}
```

Use the project's git top level instead of `$.session.cwd()` if your list lives there, as the previous guide does.

## Common mistakes and how to test it

These come from Narsil Check's code and tests:

- **Registering before the session binds.** `$.tool.register` rejects until `session.start`. Register there.
- **Declaring without serving.** "a call no hook answers fails". Every name needs its `tool.call` hook, matched on the full `mcp__<plugin>__<name>`.
- **Answering in MCP's shape.** `{ content, isError }` is refused. Use `result` or `deny`.
- **Letting an exception escape.** Claude gets a failure with no reason. Wrap and answer `deny` with the cause.
- **Descriptions that say only what.** Say when to call it too; that is what the model acts on.
- **A second writer.** A tool that writes the file its own way bypasses the safety rules. Reuse the pane's function.
- **Matching names loosely in code but strictly in the description.** `todo_done` accepts an id or a name ignoring case; its schema says "exact name", which keeps the model precise while the code stays forgiving.

To test, `claude plugin test .` runs `tests/todos.test.tsx`. "Claude's tools list, add and finish tasks, and a change made elsewhere is kept" calls the tools through `$.tool.call` and checks the texts and the file, including a task another writer added in between. "Claude is told about a damaged list instead of reading it as empty" checks the `deny` on a broken file, and "a list that cannot be written gives Claude a readable error, and the pane a toast" the `answered` path. "a task for a template lands in that folder, and an unclear name asks which one", "a template named by its absolute path is used as given; an unknown one asks the user" and "/narsil-check template hands the request to Claude, who knows how the work was done" cover the template tool and its command.

## Going further

- `$.tool.register` also takes `isDeferred: false`, which puts a tool's schema in the prompt's tool list. Worth it only for a tool the model needs on almost every turn.
- A `todo_update` tool that edits a task's content would let Claude add what it learned while working on it.
- The same pattern serves any panel data the model should act on: a tool that reads the vulnerabilities of guide 14 would let Claude open a fix PR from them.
- The next and last guide of this path goes back to upgrades, for the hardest case: Kotlin, Gradle and the Android Gradle Plugin.
