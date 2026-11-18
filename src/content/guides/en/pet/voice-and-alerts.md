---
title: Voice and alerts
description: "How Narsil picks a random phrase for each moment, says it aloud with Windows' or macOS's own voices, and tells you through the floating window or a system notification."
route: pet
order: 6
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: overlay/speak.ps1
  - repo: pet
    path: overlay/speak.sh
  - repo: pet
    path: overlay/toast.ps1
  - repo: pet
    path: overlay/toast.sh
  - repo: pet
    path: docs/plan-advice.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## What it does

Narsil speaks, in Spanish, at the moments that matter:

| Moment                                   | An example of what she says                                         |
| ---------------------------------------- | ------------------------------------------------------------------- |
| You send a prompt and the work starts    | "Estoy en eso." ("I'm on it.")                                      |
| A turn finishes                          | "Listo, ya quedó." ("Done, that's it.")                             |
| A question, a permission or a plan waits | "Te necesito un momento." ("I need you for a moment.")              |
| A turn stops on an error                 | "Tuve un tropiezo y me detuve." ("I stumbled and stopped.")         |
| Something has waited five minutes        | "Sigo aquí, esperándote." ("I'm still here, waiting for you.")      |
| A background subagent finishes or stops  | "Un ayudante terminó su encargo." ("A helper finished its errand.") |

Each moment has between four and ten phrases, and she picks one at random each time, so she does not repeat herself. She speaks of herself in the first person and never by name.

Along with the voice comes a written alert with a title and a text, such as "He terminado" ("I have finished") over a short summary of Claude's answer. Where it shows depends on one setting:

- **With the floating window on** (the default), the alert shows in the window, which pops up for it. No system notification is sent as well.
- **With the floating window off**, the alert arrives as a notification. On Windows, clicking it opens that conversation.

Three commands tune it. `/narsil silencio` and `/narsil voz` turn the voice off and on. `/narsil discreto` (quiet mode) keeps her silent, drops the "turn finished" alerts, and still tells you, without speaking, when something needs you or fails; `/narsil normal` undoes it. `/narsil prueba` plays a test alert with its voice, so you can hear which voice your system picked.

## How it works inside

### The phrases: `hooks/words.ts`

The words live in their own file, apart from the hooks. `VOICE` is an object with one list per moment: `start`, `done`, `error`, `question`, `stillWaiting`, `agentDone` and `agentStopped`. `say(moment)` returns one phrase from that list, chosen with `Math.random()`.

The comment above `VOICE` sets the style rules: neutral Latin American Spanish, the simple past, no words used only in Spain, the voice of a calm and warm assistant, "composed, a little playful, never servile", speaking of herself in the first person. Those rules are tested, as described below, so a new phrase that breaks them fails the build.

Keeping the words apart has a practical reason: it lets the tests read every phrase without running a session, and lets someone change her voice without touching the event logic.

### One function decides where an alert goes: `announce`

Every alert goes through `announce` in `hooks/register.tsx`. It receives a kind (`done`, `question` or `error`), a title, a text and the phrase to say. In order, it:

1. Reads the preferences. In quiet mode, a `done` alert stops here unless it is forced (the test is).
2. Starts speaking, unless muted or quiet. It does not wait for the voice before going on.
3. With the floating window on, sends the alert to the hub as `POST /event`. If the hub is down, `ensureOverlay` starts it (at most once a minute) and the alert is sent again.
4. With the window off, calls `notify`.
5. Sends the alert to the phone, when phone alerts are turned on with `/narsil movil`.
6. Waits for the voice to finish.

The callers pass the moment's phrase: `say('done')` when a turn ends with an answer, `say('question')` when a turn ends on a question, `say('error')` when it fails, `say('stillWaiting')` for the five-minute reminder. The start of work is the exception: in `turn.start`, a prompt you typed (not a continuation) calls `speak` directly with `say('start')`, with no written alert.

### The voice: the mod's scripts first, the engine second

`speak` tries Narsil's own script first and falls back to the engine's voice:

```tsx
async function speak($: EngineInterface, text: string): Promise<void> {
  // The mod's own script first, so a Spanish voice is chosen when one is installed.
  if (await launch($, 'speak', { NARSIL_TEXT: text })) return
  void $.audio.speak(text).catch(() => undefined)
}
```

The comment gives the reason. `$.audio.speak` speaks with the platform's synthesizer and, by default, its default voice. On a computer set up in English, that is an English voice reading Spanish. Narsil's scripts look for a Spanish voice by name first.

**On Windows, `overlay/speak.ps1`** tries three things in order:

1. A Spanish voice of the classic speech engine (`System.Speech`), preferring "Natural" voices (the file's comment mentions an adapter that exposes Narrator voices such as Dalia there) and Latin American ones before Spain's.
2. A Spanish voice of the newer Windows speech engine (`Windows.Media.SpeechSynthesis`, the voices installed from Windows Settings), Latin American first. It writes the speech to a stream and plays it.
3. The classic engine's default voice.

**On macOS, `overlay/speak.sh`** lists the voices with `say -v '?'` and picks Paulina (Mexican) first, then another Latin American voice, then Mónica, then any Spanish voice, and otherwise the system's default, and runs `say`.

On any other system, `launch` returns false and `$.audio.speak` speaks with the platform's own synthesizer, which the 2.1.325 types describe as "`say` on macOS".

### Notifications: the engine first, the scripts second

`notify` goes the other way round: it asks the engine first.

```tsx
try {
  if ((await $.ui.notify(text, { title })).isSent) return
} catch {
  // no notification channel: the mod's own script below
}
await launch($, 'toast', {
  NARSIL_TITLE: title,
  NARSIL_TEXT: text,
  NARSIL_LINK: conversationLink(),
})
```

`$.ui.notify` returns `{ isSent: true, … }` when a channel took it, or `{ isSent: false, reason }` otherwise. The `try` is there, as the code's comment says, because where the host has no notify at all the call throws before it returns a promise. Only when the engine did not send it does Narsil use its scripts. (The README calls the result "notificación del sistema", a system notification; in the code, the engine's own channel comes first and the system scripts second.)

- **`overlay/toast.ps1`** builds a Windows toast notification with the title over the text, both escaped for XML. When `NARSIL_LINK` holds a conversation link, it makes the toast open that link on a click. It checks the link against the same pattern the hub uses, `claude://code/continue?session=local_…&source=desktop_action`, before using it.
- **`overlay/toast.sh`** calls `osascript` with `display notification`. The title and text are passed as arguments to the script, never written inside it, "so nothing in them runs", as its comment says.

### Running the scripts: `launch`

Both the voice and the notification go through `launch`, which starts a script as a process of its own and returns at once. It uses `$.process.run`, which runs a command by its argument vector with no shell and waits for it to end:

- **On macOS** it runs `/bin/sh -c 'nohup /bin/sh "$NARSIL_SCRIPT" </dev/null >/dev/null 2>&1 &'`. The shell starts the script in the background and exits, so `$.process.run` returns right away.
- **On Windows** it runs PowerShell with `Start-Process -WindowStyle Hidden`, which starts another hidden PowerShell on the script and returns.

The system is detected once, by `platformOf`: the `OS` environment variable (`Windows_NT`), otherwise `uname -s` (`Darwin` for macOS).

Two design decisions are visible here:

- **Detached, so speech outlives the hook.** A spoken phrase can take seconds. A detached process keeps speaking after the hook returns, after the turn, and after a reload of the mod, which, as the comment above `launch` notes, a `$.clock` timer would not survive.
- **Text in the environment, never in the command.** The script's path, the text and the title travel as environment variables (`NARSIL_SCRIPT`, `NARSIL_TEXT`, `NARSIL_TITLE`, `NARSIL_LINK`). The command line itself is a fixed string. The comment at the top of `speak.ps1` says why: "nothing Claude wrote can be interpreted as code". An answer that contains quotes, semicolons or `$(…)` is only ever spoken or shown.

### What the code does not use

Narsil does not play sound clips: there is no `$.audio.play` call in `hooks/register.tsx`. The only `$.audio` call is the `$.audio.speak` fallback above.

## Build it with Claude

Ask Claude for a few phrases per moment and a hook that, when a turn ends, says one aloud and sends one written alert. The one idea Claude must get right is that the voice never holds up the hook: speech can take seconds, so it is started, its rejection is caught, and it is not awaited.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> In my Claude Code mod `my-pet`, speak when a turn ends. Keep the phrases in `hooks/words.ts` as one list per moment (`done`, `question`, `error`) with at least four phrases each, and a `say(moment)` that picks one at random. In `turn.complete`, for the main conversation only, pick the moment from `e.reason` and call `$.audio.speak`, without awaiting it so the hook returns at once, and catch its rejection. Then send a notification with `$.ui.notify(text, { title })` and check `isSent`. Add a test that every moment has at least four distinct phrases and that 200 calls of `say` give more than one phrase. Check every call against the plugin-authoring types.

### What to check in Claude's answer

1. The phrases live in `hooks/words.ts`, apart from the hooks, with at least four per moment and a `say(moment)` that picks one at random.
2. `$.audio.speak` is called with `void … .catch(...)`, not awaited.
3. `$.ui.notify` sits inside a `try`, because it throws where the host has no notification channel, and its `isSent` says whether a channel took the alert.
4. Only the main conversation speaks: the hook returns early when `e.agentId` is set.
5. If Claude runs a script for the voice, the text travels in the environment or as a separate argument, never inside a shell string.

If a check fails, tell Claude what you see: "every turn ends a few seconds late, as long as the phrase takes to say".

### How the author asked for it

The original request for the voice and the notifications was not recorded. They arrive in the first commit of the overlay, before the public task logs began. The one recorded design note is in `docs/plan-advice.md`, the plan for Narsil's tips: "**Voice**: off by default (`/narsil consejos voz` turns it on)". That is a plan, not the author's words, and it is about tips, not about these alerts.

#### Reconstruction from the commit history

From `git log -- overlay/speak.ps1 overlay/speak.sh overlay/toast.ps1 overlay/toast.sh hooks/words.ts hooks/register.tsx` in narsil-pet:

- `6f8f938` (2026-10-30) "feat(overlay): add floating window, Spanish voice and Windows toasts". `speak.ps1` and `toast.ps1` arrive with the floating window.
- `088508e` (2026-10-30) "fix(notify): fall back to the system script when the host has no notify". The `try` around `$.ui.notify` and the scripts as the second choice.
- `52af072` (2026-10-30) "feat(mac): speak and notify on macOS with say and osascript". `speak.sh` and `toast.sh`.
- `a2b5970` (2026-10-30) "fix(overlay): start the window again for an event instead of a notification". With the window on, an alert goes to the window even when it has to be started again.
- `f7a494e` (2026-10-30) "feat: warn about loops, insist on waiting permissions and sum the session up". The reminder after a wait.
- `c73bc13` and `36256f9` (2026-10-31): Narsil speaks of herself in the first person, in the band, the window and the alerts.
- `17ffb30` (2026-10-31) "feat: add a quiet mode that only speaks up when Narsil needs you".
- `665bd4e` (2026-11-06) "feat: speak when work starts and vary every spoken phrase". The `start` phrases, and several phrases for every moment.
- `44f4372` (2026-11-07) "feat: speak natural neutral Latin American Spanish with more phrases". The voice order that prefers natural Latin American voices, and the style rules.

The order tells the story: first a voice and a notification that worked, then each system, then the person's comfort (first person, a quiet mode, less repetition, a more natural voice).

## Reference code

This is one correct answer, written for this guide. Read it to understand how the pieces fit together and to compare it with what Claude wrote for you: Claude may choose other names or another order and still be right.

Written for this guide and checked against the 2.1.325 types (`$.audio.speak`, `$.ui.notify`, `turn.complete`). It uses only the engine's voice and notifications. Narsil's own scripts, which choose a Spanish voice, are described above; they are adapted from `hooks/words.ts` and `hooks/register.tsx` in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later).

The phrases, `hooks/words.ts`:

```ts
export const VOICE = {
  done: ['Done.', 'All finished here.', 'Finished. Have a look when you can.', 'That is done.'],
  question: [
    'I need you for a moment.',
    'I have a question for you.',
    'Your call, please.',
    'Can you help me with something?',
  ],
  error: [
    'Something went wrong and I stopped.',
    'I hit an error.',
    'I stopped to avoid making it worse.',
    'Let us look at this together.',
  ],
} as const satisfies Record<string, readonly string[]>

export type Moment = keyof typeof VOICE

export function say(moment: Moment): string {
  const options: readonly string[] = VOICE[moment]
  return options[Math.floor(Math.random() * options.length)] ?? options[0]
}
```

The hook, in `hooks/register.tsx`:

```tsx
import type { Register } from 'claude-code'
import { say, type Moment } from './words'

export const register: Register = (on) => {
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) return result
    const moment: Moment = e.reason === 'answer' ? 'done' : 'error'
    const phrase = say(moment)
    // Not awaited: the utterance may take seconds.
    void $.audio.speak(phrase).catch(() => undefined)
    try {
      await $.ui.notify(phrase, { title: 'my-pet' })
    } catch {
      // no notification channel here
    }
    return result
  })
}
```

Narsil sends `aborted` turns (you pressed stop) nowhere: it sets the state to stopped without an alert. A fuller version would also check `e.reason === 'aborted'` and stay quiet.

## Common mistakes and how to test it

- **Awaiting the voice in the hook.** `$.audio.speak` resolves when the utterance ends. Awaited in a hook, it holds the event for seconds. Start it and catch its rejection, as Narsil does.
- **Putting the text in the command line.** If you run a script with a phrase built from Claude's answer, pass it in the environment or as a separate argument, never inside a shell string. `toast.sh` and `speak.ps1` both show the pattern.
- **Assuming a voice exists.** `$.audio.speak` rejects when there is no synthesizer or the voice is not installed. Narsil's scripts fall back step by step to the default voice.
- **Two alerts for one event.** Narsil sends an alert to the window or to the system, never both, and the README states it the same way.
- **Notifying while the person is looking.** With the floating window on, the hub drops an event that arrives while Claude is in front, unless it is forced. The voice still speaks.
- **Repeating one phrase.** The same sentence every turn turns into noise quickly; several phrases per moment fix it at almost no cost.

To test, `claude plugin test .` runs `tests/narsil.test.tsx`. "each moment Narsil speaks has several phrases, so she does not always say the same" checks at least four distinct phrases per moment and calls `say('start')` 200 times. "what Narsil says is neutral Latin American Spanish: no Spain-only words, the simple past" enforces the style rules with two regular expressions, and checks that no phrase contains her name. "on macOS Narsil speaks and notifies with its own scripts, detached, never PowerShell" runs `/narsil prueba` with a fake macOS and checks the exact `nohup` command and the `NARSIL_TEXT` and `NARSIL_TITLE` it passes. "on Windows Narsil still speaks and starts the window through PowerShell" covers the other side, and "with the window on but down, an event starts it again and shows there, never as a notification" covers `announce`'s choice. To hear the result on your own computer, run `/narsil prueba`.

## Going further

- `nudgeText` in `hooks/watch.ts` builds the five-minute reminder's text, and `NUDGE_AFTER_MS` sets the wait.
- `summary` in `hooks/words.ts` cuts Claude's answer to the short text of the "He terminado" alert, with a longer version for the phone.
- `/narsil consejos voz` lets Narsil speak her end-of-turn tips too; it is off by default, as `docs/plan-advice.md` planned.
- The README's "Sistemas compatibles" table lists the voice and the notifications for each system.
