---
title: Reactions to commands
description: 'How Narsil reads the shell commands Claude runs: she cheers passing tests, notices failing ones, and warns about commands that cannot be undone without ever blocking them.'
route: pet
order: 9
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: hooks/watch.ts
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## What it does

Every time Claude runs a shell command (the `Bash` or `PowerShell` tool), Narsil reads the command line and reacts to two kinds of command.

**Tests.** When the command runs a project's tests, Narsil waits for the result:

- If it succeeds, she celebrates in the band: "¡Los tests pasan! 🎉" ("the tests pass!"), and earns 5 experience points.
- If it fails, she flinches (the "scared" pose of the earlier guides) and says "Los tests fallan; vamos a ver por qué." ("the tests fail; let's see why").
- The next time they pass after a failure, she says "¡Recuperados! Los tests vuelven a pasar." ("recovered! the tests pass again").

The README lists the runners she recognizes: npm, pnpm, yarn, bun, vitest, jest, pytest, go, cargo, dotnet, maven, gradle and more.

**Commands that cannot be undone.** Before such a command runs, the band's comment turns into a warning, "⚠️ Cuidado: … no tiene vuelta atrás." ("careful: … cannot be undone"), with the name of the kind of command in the gap. A line also goes to the terminal log, with the first line of the command. Then the command goes ahead as usual. The README is plain about it: "Solo avisa: nunca bloquea nada." (it only warns, it never blocks anything).

What this gives you: a glance at the band tells you whether the last test run passed, and a destructive command gets a second pair of eyes while the permission dialog, if there is one, is still on screen.

## How it works inside

### One hook in front of every tool: `tool.call`

Both reactions live in the `tool.call` hook in `hooks/register.tsx`. A `tool.call` hook wraps the call: code before `next(e)` runs before the tool, and `await next(e)` returns the tool's result. That shape is what lets Narsil warn before the command and react to tests after it.

The hook first discards what is not Claude's work:

- A call another mod makes (with `$.tool.call` or `$.mcp.call`) also raises `tool.call`. `isClaudesCall` in `hooks/watch.ts` keeps only calls whose `next.origin.plugin` is `"engine"`. The comment explains the bug it fixed: no turn ends a call made by another mod, so it left Narsil "working" until the next prompt (`21df208`).
- Only `Bash` and `PowerShell` carry a command line (`SHELL_TOOLS` in `hooks/words.ts`). For every other tool the command is the empty string, and neither reaction can fire.

Unlike the band's state, this part does not skip subagents: a test run by a subagent is cheered too.

### Recognizing a test run

`TEST_COMMAND` in `hooks/words.ts` is one regular expression over the command line:

```ts
export const TEST_COMMAND =
  /\b(?:(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?test|(?:go|cargo|dotnet|mvn|gradle|gradlew|deno|mix)\s+test|claude\s+plugin\s+test|python3?\s+-m\s+(?:pytest|unittest)|vitest|jest|pytest|mocha|phpunit|rspec)\b/
```

It searches anywhere in the line, so a command that changes directory first and then runs the tests still counts.

Whether the tests passed is not read from their output. Narsil looks only at `result.isError`, the tool's own verdict on the call. Parsing the output of a dozen runners, each with its own summary format, would break with every new runner or version; the tool's error flag is the same signal for all of them, and it is the one a CI job relies on too. The price is that Narsil only knows "passed" or "failed", not how many.

A module variable, `areTestsFailing`, remembers that the last run failed. That one flag is what turns the next success into "recovered" instead of a plain cheer.

A failure also feeds the tips of guide 11: the error text is kept, and two failures of the same tool in one turn ask for a debugging tip.

### Recognizing a dangerous command

`DANGEROUS_COMMANDS` in `hooks/words.ts` is a list of pairs: the name Narsil warns with, and the pattern that finds it. An excerpt, reduced to the patterns:

```ts
const DANGEROUS_COMMANDS: readonly (readonly [name: string, pattern: RegExp])[] = [
  ['rm -rf', /\brm\s+(?:-[a-zA-Z]*(?:[rR]f|f[rR])[a-zA-Z]*|-[rR]\s+-f|-f\s+-[rR])\b/],
  ['git push --force', /\bgit\s+push\b[^|;&\n]*\s(?:--force(?!-with-lease)|-f)\b/],
  ['git reset --hard', /\bgit\s+reset\s+--hard\b/],
  ['Remove-Item -Recurse -Force', /\bRemove-Item\b(?=[^|;\n]*-Recurse\b)(?=[^|;\n]*-Force\b)/i],
  ['DROP', /\bdrop\s+(?:table|database|schema)\b/i],
  // ... also git clean -f, git branch -D, chmod -R 777, mkfs, dd onto a device
  // and 'descargar y ejecutar' (download and run): curl, wget or
  // Invoke-WebRequest piped into a shell
]
```

A few details show the care in the patterns:

- The force push excludes `--force-with-lease`, the variant that refuses to overwrite work it has not seen.
- `[^|;&\n]*` keeps the flag inside the same command: a `--force` after a pipe or a `;` belongs to another command.
- The `rm` pattern accepts the flags joined in any order or written apart.
- The PowerShell one needs both `-Recurse` and `-Force`, in any order, with lookaheads.

`dangerOf(command)` returns the name of the first pattern that matches, or `null`.

### Why it warns instead of denying

A `tool.call` hook could refuse the call: the 2.1.325 types document `{ deny: reason }` as an answer, and the model then receives the text as an error result. Narsil never does it. Neither the code nor the README says why in so many words; the README only states that it never blocks. The reasons below are this guide's reading of the code and the types:

- **The patterns are guesses.** Deleting a build folder recursively is routine in many scripts. A block on every match would stop legitimate work, and the model would look for another way to do the same thing. The patterns also miss things (long option names, a script file that contains the command), so a block would promise a safety it cannot give.
- **Claude Code already has the lock.** The types describe `tool.check` as firing "after the `tool.call` and PreToolUse hooks and before the mode settles an ask". Permission rules and the permission dialog are where a command is stopped; Narsil's warning arrives before that decision, while you can still answer no.
- **A mod's hook is a weak guard anyway.** The types warn that "a guard that fails is skipped and the tool runs". A real guard needs care Narsil does not need to take as a companion.

### What it shows

The reactions go through `setMood`, the single entry point of the first guide: the mood stays the tool's own ("running" for a shell, "scared" on a failure), and the comment line carries the warning or the cheer. The terminal log line is written with `$.ui.log`, cut to the first line of the command and 120 characters. The warning is set before `next(e)`, so it is on screen while the command waits for permission or runs.

## How it was asked of the AI

The original request for these reactions was not recorded. They arrived on 2026-10-30, before the project's public task logs (`odd/tasks/fleet-view.md` starts on 2026-11-06 and does not mention them).

### Reconstruction from the commit history

From `git log -- hooks/register.tsx hooks/words.ts hooks/watch.ts` in narsil-pet:

- `c885292` (2026-10-30) "feat: estimate when the context fills, react to tests and dangerous commands, show subagents". The test pattern, the list of dangerous commands and the "recovered" flag arrive together in this commit, inside the `tool.call` hook.
- `8913cdd` (2026-10-30) "feat: let Narsil earn experience and levels kept across sessions". Passing tests start to earn experience.
- `0cfc369` (2026-10-31) "refactor: move Narsil's wording and labels out of the hooks module". The patterns move to `hooks/words.ts`, where they are today.
- `21df208` (2026-11-06) "fix: ignore tool calls other mods make, so Narsil no longer sticks at working". The `isClaudesCall` filter above.

The patterns themselves have not changed since they were written: `git log -S` finds them only in the first commit and the move.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> In my Claude Code mod `my-pet`, add a `tool.call` hook that reacts to shell commands. Skip calls whose `next.origin.plugin` is not `"engine"`, and tools other than `Bash` and `PowerShell`. Before calling `next(e)`, match `e.command` against a list of named regular expressions for commands that cannot be undone (recursive force delete, force push but not `--force-with-lease`, hard reset, dropping a table); on a match, write a warning with the name to an atom shown in the `AbovePrompt` band and log it with `$.ui.log`, and never return `{ deny }`. After `next(e)`, if the command matches a test-runner pattern, show "Tests pass" when `result.isError` is false and "Tests fail" when it is true, and "Recovered" when they pass after a failure. Add tests with `claude-code/testing` where the tool is answered by a hook, so nothing really runs.

## The minimal code

Written for this guide and checked against the 2.1.325 types (`tool.call`, `next.origin`, `$.ui.log`, `ui.render`). It is adapted from `hooks/register.tsx` and `hooks/words.ts` in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). The `line` atom is declared in `types/index.d.ts` as in the first guide, with the type `string`.

```tsx
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

const line = atom({ plugin: 'my-pet', key: 'line' } as const, '')

const TEST =
  /\b(?:(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?test|vitest|jest|pytest|cargo\s+test|go\s+test)\b/
const DANGER: readonly (readonly [string, RegExp])[] = [
  ['rm -rf', /\brm\s+(?:-[a-zA-Z]*(?:[rR]f|f[rR])[a-zA-Z]*|-[rR]\s+-f|-f\s+-[rR])\b/],
  ['git push --force', /\bgit\s+push\b[^|;&\n]*\s(?:--force(?!-with-lease)|-f)\b/],
  ['git reset --hard', /\bgit\s+reset\s+--hard\b/],
]
let testsFailing = false

export const register: Register = (on) => {
  on('tool.call', async ($, e, next) => {
    if (next.origin.plugin !== 'engine') return next(e)
    if (e.tool !== 'Bash' && e.tool !== 'PowerShell') return next(e)
    const command = e.command

    const danger = DANGER.find(([, pattern]) => pattern.test(command))?.[0]
    if (danger) {
      $.ui.log(`⚠️ my-pet: ${danger} cannot be undone: ${command.split('\n')[0]!.slice(0, 120)}`)
      await update($, line, () => `⚠️ Careful: ${danger} cannot be undone.`)
    }

    // Warn only: the call always goes on to the engine.
    const result = await next(e)

    if (TEST.test(command)) {
      const text = result.isError
        ? 'The tests fail; let us see why.'
        : testsFailing
          ? 'Recovered! The tests pass again.'
          : 'The tests pass! 🎉'
      testsFailing = !!result.isError
      await update($, line, () => text)
    }
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const text = await read($, line)
    if (!text) return next(e)
    const { Text } = $.ui.resolve(e)
    return <Text wrap="truncate-end">{text}</Text>
  })
}
```

## Common mistakes and how to test it

- **Reacting to other mods' calls.** Another mod's `$.tool.call` raises `tool.call` too, and no turn ends it. Check `next.origin.plugin === 'engine'` (`21df208`).
- **Warning after the fact.** A warning set after `await next(e)` arrives once the command has run. Set it before.
- **Turning the warning into a block.** Returning `{ deny }` from a pattern match stops legitimate work and invites the model to find a way around it. Leave the decision to the permission system.
- **Trusting the error flag too far.** A command that hides its own exit status (piping the test run into another program, or ending it with a fallback that always succeeds) reads as a pass. Narsil cannot tell, and neither can your copy.
- **Testing with real destructive commands.** Never run them to see the warning. In a test, answer the tool from a hook so nothing executes.

To test, `claude plugin test .` runs `tests/narsil.test.tsx`. "a dangerous command is flagged before it runs, and an ordinary one is not" answers every `tool.call` from a hook with `{ result: {} }`, so no command reaches a shell, and reads the comment line pushed to the floating window at the moment each call arrives. It expects the four warnings for four destructive commands, and no warning for an ordinary push. "tests that pass are cheered, and failing ones are noticed until they pass again" covers the cheer, the failure and the recovery.

## Going further

- `describeCall` in `hooks/words.ts` builds the band's detail for each tool (a file's name, a command's first line); the reactions reuse the same detail.
- `gainXp($, 'tests')` adds the 5 points; `hooks/xp.ts` holds the amounts and the levels.
- The failures this hook records (`seen.failures`) are part of what the tips of guide 11 send to the model.
- `DANGEROUS_COMMANDS` is easy to extend: one name and one pattern per line. Keep each pattern inside one command with `[^|;&\n]`, as the existing ones do.
