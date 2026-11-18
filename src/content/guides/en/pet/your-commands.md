---
title: Your own /commands
description: 'How /narsil is registered as one slash command with many subcommands, how its words are dispatched, how the bare command doubles as help, and how to test it.'
route: pet
order: 17
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: docs/plan-advice.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## What it does

Every feature in this path has a switch or a question, and all of them live under one slash command: `/narsil`. You type `/narsil` and a word, and Narsil answers in the transcript. Typed alone, `/narsil` tells you how she is set up and lists every word it takes.

The words, as the code dispatches them (Narsil speaks Spanish, so the words are Spanish):

| Command                                                             | What it does                                                                              |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `/narsil`                                                           | Shows the current settings and the usage line.                                            |
| `/narsil estado`                                                    | Says what she is doing, how many conversations are open, and on which surfaces she draws. |
| `/narsil ocultar` · `mostrar`                                       | Hides or shows the band.                                                                  |
| `/narsil silencio` · `voz`                                          | Turns the voice off or on.                                                                |
| `/narsil discreto` · `normal`                                       | Turns quiet mode on or off (guide 14).                                                    |
| `/narsil flotante`                                                  | Turns the floating window on or off (guide 5).                                            |
| `/narsil prueba`                                                    | Sends a test alert, with voice.                                                           |
| `/narsil consejo` · `consejo profundo`                              | Asks for a tip now, or one over the whole conversation (guide 11).                        |
| `/narsil consejos on` · `off` · `cada <min>` · `voz`                | Automatic tips on or off, their spacing, spoken or not.                                   |
| `/narsil pasos on` · `off`                                          | Next steps on or off (guide 12).                                                          |
| `/narsil cache` · `cache <min>` · `cache auto`                      | Says, sets or deduces how long the prompt cache lasts (guide 8).                          |
| `/narsil resumen`                                                   | The session summary (guide 16).                                                           |
| `/narsil nivel`                                                     | Level, stage and how she earns XP (guide 13).                                             |
| `/narsil movil` · `on` · `off` · `nuevo` · `prueba` · `clave [off]` | Phone alerts (guide 15).                                                                  |

The README's "Comandos" table lists the same words, and they agree with the code.

One command instead of fifteen keeps the typeahead clean: you type `/nar`, and everything Narsil can do is behind one name.

## How it works inside

### Registering: `$.command.register`

A mod declares a slash command at run time. Narsil does it first thing in `session.start`:

```tsx
await $.command.register({
  name: 'narsil',
  description:
    'Narsil, tu mascota: estado | ocultar | mostrar | silencio | voz | discreto | normal | flotante | prueba | consejo [profundo] | consejos on|off|cada <min>|voz | pasos on|off | cache [auto|<min>] | resumen | nivel | movil [on|off|nuevo|prueba|clave [off]]',
})
```

The 2.1.325 types describe `$.command.register` as "Declares the slash command `/<name>` for this session, listed in the typeahead from the next keystroke on". Three points of that sentence shape the design:

- **"for this session".** The registration does not outlive the session, which is why it happens in every `session.start`.
- **The spec.** `CommandSpec` has `name` (letters, digits, `_` and `-`, up to 64), `description` ("The one line the typeahead and `/help` show for it"), an optional `argumentHint` ("The hint drawn dim after the name") and an optional `immediate`. "Registering a name again replaces it; a built-in's name is refused."
- **Serving it.** "Serve it with a `command.run` hook on `{ command: "<name>" }` that returns `{ text }`".

Narsil puts the list of words in `description`, so the typeahead and `/help` show them all (the description starts "Narsil, tu mascota", "Narsil, your pet"). It does not use `argumentHint`; a short hint such as `[estado | resumen | …]` would be the alternative, at the cost of showing less.

It does not set `immediate` either. Without it, the types say, a command typed while a turn is in flight waits "for the turn to end". `/narsil discreto` typed mid-turn therefore takes effect after the turn. With `immediate`, the hook "must not assume the turn's state", which is a lot to ask of a handler that reads and writes so much of it.

### Serving: one `command.run` hook

The hook is registered with a matcher, so it runs only for `/narsil`:

```tsx
on('command.run', { command: 'narsil' }, async ($, e) => {
  await noteOrigin($, e.origin)
  const arg = e.args.trim().toLowerCase().replace(/\s+/g, ' ')
  // …
})
```

It never calls `next`. The types explain what that means: "A hook's own answer without `next` runs no command: its `text` is shown as the command's output". Since nothing else implements `/narsil`, there is nothing to pass on to.

Three things happen before any word is read:

- **`noteOrigin($, e.origin)`.** A command's `origin` says where it came from, as `prompt.submit`'s does. Running `/narsil` from the phone counts as writing from away (guide 15).
- **Normalizing the words.** `e.args` is "Everything after the name, as typed". Narsil trims it, lowercases it and collapses runs of spaces, so `/narsil  Consejos   OFF` works.
- **Accents.** The phone group takes `movil` and `móvil`, and the cache's pattern, `/^cach[eé](?: (auto|\d{1,3}))?$/`, takes `cache` and `caché`. People type both.

### Dispatching: groups that answer "not mine"

The body is a chain. The three larger groups each live next to their feature, as functions that return the answer's text, or `undefined` for words that are not theirs:

```tsx
const advice = await adviceCommand($, arg)
if (advice !== undefined) return { text: advice }
const stepped = await stepsCommand($, arg)
if (stepped !== undefined) return { text: stepped }
const phoned = await phoneCommand($, arg)
if (phoned !== undefined) return { text: phoned }
```

- `adviceCommand` takes `consejo`, `consejo profundo` and `consejos …`.
- `stepsCommand` takes `pasos on|off` and `cache [auto|<min>]`.
- `phoneCommand` takes `movil …`.

A group that recognizes its first word but not the rest answers with its own usage line instead of `undefined`: `/narsil consejo raro` gets "Uso: /narsil consejo [profundo] | consejos on | off | cada <min> | voz", and `/narsil movil raro` gets "Uso: /narsil movil [on | off | nuevo | prueba | clave [off]]". The person sees the words that fit what they were trying to do, not the whole list.

Then the main handler takes the rest itself: `resumen` and `nivel` answer at once; `prueba`, `estado` and `flotante` each have a branch; and six on/off words share one table, `change`, that maps each word to a patch of the preferences (`ocultar` to `{ isHidden: true }`, `discreto` to `{ isQuiet: true }`, and so on). A known word is merged into the `prefs` atom and saved with `$.store.set('prefs', …)`, so every setting outlives the session.

The design keeps each feature's words with the feature. Adding a group of commands to a feature means one function in its own section and one line in the chain.

### The bare command is the help

Anything the chain does not recognize, the empty `/narsil` included, falls to the end, where `patch` is undefined. That branch reads the preferences and prints them: whether the band is visible, the voice on, the floating window on; the tips and their spacing; the next steps and how long the cache lasts; a line for quiet mode when it is on. The last line is the usage line, the same list of words as the description.

So there is no separate `ayuda` ("help") word: a typo and a plain `/narsil` both answer with the state and the words. This matches the README, whose first row says `/narsil` "Muestra la configuración actual y la ayuda" ("shows the current settings and the help").

The list of words lives in three places: the description, the usage line, and the README. The tips plan, `docs/plan-advice.md`, says it outright when it adds the `consejo` words: "Update the command description and the usage text of `/narsil`." Keeping the three in step is a manual task in Narsil.

### What the answer is

Each branch returns `{ text }`, a `CommandRunResult`. Two of its fields are worth knowing about even though Narsil does not use them. `context` is "What the model reads after the command's output and the person never sees". `isTextDisplayOnly` keeps the text out of the model's requests, but the types say it is honored only when every plugin hooking the command is bundled with Claude Code: "Any other plugin's text stays in requests". So everything `/narsil` answers, the phone key of guide 15 included, is part of what the model reads.

## Build it with Claude

Ask Claude for one slash command with subcommands, registered when the session starts and served by one hook. The one idea Claude must get right is the dispatch: each feature answers its own words and returns `undefined` for the rest, and anything left over prints the settings and the usage line.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> Give my Claude Code mod `my-pet` one slash command, `/my-pet`, with subcommands. In `session.start`, call `$.command.register` with the name and a description that lists every subcommand. Serve it with one `command.run` hook matched on `{ command: 'my-pet' }` that returns `{ text }` without calling `next`. Normalize `e.args` (trim, lowercase, single spaces). Give each feature its own function that returns the answer for its words, its own usage line for a known first word with unknown rest, or `undefined` for words that are not its own, and chain them. Map simple on/off words to a patch of a `prefs` atom saved with `$.store.set`. For an empty or unknown argument, print the current settings and the usage line. Keep the description, the usage line and the README in step. Test with `claude-code/testing`, calling `$.command.run({ command: 'my-pet', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } })`, that each word answers and that an unknown word prints the usage line.

### What to check in Claude's answer

1. `$.command.register` runs in `session.start`, in every session, because a registration lasts only for the session.
2. The `command.run` hook is matched on the command's name, returns `{ text }` and never calls `next`.
3. `e.args` is trimmed, lowercased and its runs of spaces collapsed before any word is compared.
4. Each feature's function returns its answer, its own usage line for a known first word with an unknown rest, or `undefined`; an empty or unknown argument prints the settings and the usage line.
5. The description and the usage line list the same words, ideally from one constant.

If a check fails, tell Claude what you see: "`/my-pet  Tips OFF`, with extra spaces and capitals, answers with the usage line instead of turning the tips off".

### How the author asked for it

The original request for `/narsil` was not recorded. What is recorded is a plan step: in `docs/plan-advice.md`, under the commands the tips add, the plan says:

> "Update the command description and the usage text of `/narsil`."

That is the plan's wording, not the author's request.

#### Reconstruction from the commit history

From `git log -G "Narsil, tu mascota" -- hooks/register.tsx`, which finds every commit that changed the registered description:

- `b1187f3` (2026-10-30) "feat: show Narsil above the prompt with clear states and /narsil". The command is born with the band, and its first description reads "Narsil, tu mascota: estado | ocultar | mostrar | silencio | voz | flotante | prueba".
- `467a64b` (2026-10-30) "feat(advice): give short, concrete tips about the work in progress". The `consejo` words.
- `0993bd7` (2026-10-30) "feat: show a prompt-cache clock and offer next steps after a turn". `pasos` and `cache`.
- `f7a494e` (2026-10-30) "feat: warn about loops, insist on waiting permissions and sum the session up". `resumen`.
- `8913cdd` (2026-10-30) "feat: let Narsil earn experience and levels kept across sessions". `nivel`.
- `17ffb30` (2026-10-31) "feat: add a quiet mode that only speaks up when Narsil needs you". `discreto` and `normal`.
- `d91997f` (2026-10-31) "feat: send what needs you to your phone and watch through ntfy, with Narsil's picture". `movil`.
- `5a9ee10` (2026-11-01) "feat: seal phone messages with /narsil movil clave, send reset times and an Abrir Claude button". `clave`.

The command grew one word at a time, each with the feature it controls, and each commit touched the description in the same change. That is the habit the plan asks for.

## Reference code

This is one correct answer, written for this guide. Read it to understand how the pieces fit together and to compare it with what Claude wrote for you: Claude may choose other names or another order and still be right.

Written for this guide and checked against the 2.1.325 types (`$.command.register`, `command.run`, `$.store.get`, `$.store.set`, `session.start`). It is adapted from `hooks/register.tsx` in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). The `prefs` atom is declared in `types/index.d.ts` as `{ isHidden: boolean; isMuted: boolean }`.

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const WORDS = 'status | hide | show | mute | voice | tips on|off'
const prefs = atom({ plugin: 'my-pet', key: 'prefs' } as const, { isHidden: false, isMuted: false })

// One feature's words: its answer, its own usage line, or undefined when the words are not its own.
async function tipsCommand($: EngineInterface, arg: string): Promise<string | undefined> {
  if (arg === 'tips on' || arg === 'tips off')
    return `My pet: tips ${arg === 'tips on' ? 'on' : 'off'}.`
  if (arg.startsWith('tips')) return 'Usage: /my-pet tips on | off'
  return undefined
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    // Registered for this session only: every session registers it again.
    await $.command.register({ name: 'my-pet', description: `My pet: ${WORDS}` })
    const saved = await $.store.get('prefs').catch(() => undefined)
    if (saved && typeof saved === 'object') await update($, prefs, (p) => ({ ...p, ...saved }))
    return next(e)
  })

  on('command.run', { command: 'my-pet' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase().replace(/\s+/g, ' ')
    const tips = await tipsCommand($, arg)
    if (tips !== undefined) return { text: tips }

    const change: Record<string, { isHidden?: boolean; isMuted?: boolean }> = {
      hide: { isHidden: true },
      show: { isHidden: false },
      mute: { isMuted: true },
      voice: { isMuted: false },
    }
    const patch = arg === 'status' ? undefined : change[arg]
    if (!patch) {
      // The bare command, a typo and "status" all answer with the state and the words.
      const p = await read($, prefs)
      return {
        text: `My pet is ${p.isHidden ? 'hidden' : 'visible'}, with the voice ${p.isMuted ? 'off' : 'on'}.\nUsage: /my-pet ${WORDS}`,
      }
    }
    const saved = await update($, prefs, (p) => ({ ...p, ...patch }))
    await $.store.set('prefs', saved).catch(() => undefined)
    return { text: `My pet: done (${arg}).` }
  })
}
```

`WORDS` is written once and used for both the description and the usage line, which removes one of the three places Narsil keeps in step by hand. The README is still yours to update.

## Common mistakes and how to test it

- **Registering once.** A registration lasts for the session. Register in `session.start`, every time.
- **A name that is taken.** "a built-in's name is refused". Pick a name that is clearly your mod's.
- **Calling `next` from your own command.** There is no command behind yours to run; answer with `{ text }`.
- **Exact matching on raw input.** People type extra spaces, capitals and accents. Normalize first, and accept the accented forms you expect.
- **One giant `if` chain.** It works, but every feature's words end up far from the feature. Let each feature own its words and return `undefined` for the rest.
- **A help that drifts.** The description, the usage line and the README must say the same. Build the first two from one constant if you can.
- **Secrets in answers.** A command's text stays in the model's requests. Print a secret only when the person must copy it, and say so.

To test, `claude plugin test .` runs `tests/narsil.test.tsx`, where commands run through `$.command.run({ command: 'narsil', args: 'nivel', ...TYPED })`. `TYPED` is `{ origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } }`: a command typed at the desk. `BY_PHONE` swaps the origin for `{ kind: 'bridge' }` to run one from Remote Control. Tests worth reading by name: "/narsil estado tells which surfaces asked to draw the band, and which never did", "/narsil discreto keeps her quiet, and /narsil normal brings everything back", "/narsil consejos off stops automatic tips, and /narsil consejo still answers" and "/narsil movil nuevo changes the topic, and /narsil movil prueba sends one".

### Where the code and the README differ

They agree on every word. One small slip is in the code: the fallback's usage line is written `'Uso:/narsil estado | …'`, without the space after the colon that the subgroups' usage lines have. It dates from `17ffb30`; before it the line read `'Uso: /narsil …'`.

## Going further

- `phoneCommand` in `hooks/register.tsx` is the clearest of the groups to copy: it splits the first word from the rest, saves through one small `save` helper, and ends with its own usage line.
- `stepsCommand` shows a word with an optional number, parsed with one regular expression and clamped (`Math.min(1440, Math.max(1, …))`).
- `$.command.list()` returns every slash command the person can run, and `$.command.run` runs one as if typed; both are in the 2.1.325 types.

This is the last guide of the path "Your own status pet". Its index lists all seventeen guides, from the states at a glance to these commands, if you want to go back to any feature. For the ground every guide stands on, the "Mod fundamentals" guides cover what a mod is made of, the `$` object, how to install, reload, validate and test a mod, the surfaces it runs on, and what Narsil's GPL v3 means when you reuse its code.
