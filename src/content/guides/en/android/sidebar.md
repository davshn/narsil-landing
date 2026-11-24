---
title: The block in the side menu
description: 'The block under the search in Claude side menu: Narsil level and the ntfy count from the mod state, the 5-hour and weekly limits from claude.ai every minute, and the lock notice.'
route: android
order: 4
updated: 2026-11-24
sources:
  - repo: android
    path: app/src/main/assets/page/content.js
  - repo: android
    path: app/src/main/assets/page/lib/state.js
  - repo: android
    path: app/src/main/assets/page/lib/live.js
  - repo: android
    path: app/src/main/assets/host.js
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/StateModel.kt
  - repo: pet
    path: hooks/phone.ts
  - repo: pet
    path: hooks/register.tsx
---

## What it does

Open Claude's side menu in the app and, just under the search, Narsil adds a block with three kinds of data:

| What                                                                     | Where it comes from              |
| ------------------------------------------------------------------------ | -------------------------------- |
| **Narsil**, her picture, her level and her experience, with a bar        | The Narsil mod, through ntfy.sh  |
| **`5 horas`** and **`Semana`** (5 hours and week): your two usage limits | `claude.ai` itself, every minute |
| **`ntfy hoy`** (ntfy today): the day's ntfy.sh messages and their reset  | The Narsil mod, through ntfy.sh  |

Each limit shows a percent, a bar in green, amber or red, and when it resets, such as `reinicia en 2 h 05 min` (resets in 2 h 05 min). The level reads like `Narsil ⭐ Nivel 28` with `30/2800 XP` beside it.

The block also speaks when something is missing. With no topic in the settings, it says `Toca y escribe tu topic` (tap and write your topic). When the mod's state is encrypted and the app cannot open it, it says `🔒 Toca y pon la clave` (tap and put in the key). A tap on either notice, or on Narsil herself, opens the app's settings.

> **Experimental.** The block finds its place by the structure of Claude's side menu, and reads your limits from an internal address of the `claude.ai` page, not from a public API. A Claude update can break either; when it does, the block stops showing or loses its limits, and Claude keeps working. It only reads.

ntfy.sh is used only for what the page cannot know. The level and the count change when the mod sends a state, which is when you write to Claude Code through Remote Control. When the count is more than an hour old, the block says so.

## How it works inside

The block is drawn by `assets/page/content.js`, like the strip of [guide 3](/en/android/conversation-band/), and both share the page observer of `lib/watch.js`. The limits are read by `content.js` itself, from the page, with rules in `lib/live.js`. The level and the count arrive from the app's Kotlin code over the channel of [guide 2](/en/android/webview-host/), and `lib/state.js` shapes them.

### Finding the search in any language

The block is not found by the word "Search", which changes with the page's language. It is found by where the search sits. From `content.js` in narsil-android (MIT):

<!-- prettier-ignore -->
```js
  // Under the search, found by where it sits and so in any language: on a phone
  // the sidebar is a sheet with the search in its header; on a wider screen
  // it is the only direct button of the list's first block. The page mounts
  // the sidebar late and again at times: she goes back under it.
  const PHONE_SEARCH = '.df-phone-sheet-header'
  const WIDE_SEARCH = '.dframe-nav-scroll > .shrink-0 > button'
  function place() {
    const search = document.querySelector(PHONE_SEARCH) || document.querySelector(WIDE_SEARCH)
    if (search && search.nextElementSibling !== band) search.after(band)
    drawEvent()
  }

  self.narsilWatch(place)
```

`place` runs on every change the page observer sees, at most once a frame. If the block is not right after the search, it goes there. The two selectors are class names of `claude.ai`'s current markup, and they are the most fragile lines in this guide: a redesign of the side menu is enough to lose the block.

### The limits, from `claude.ai` every minute

The 5-hour and weekly limits are your account's, and `claude.ai` already knows them. The block reads them the same way the strip reads a conversation, with the page's session and a `GET` request. From `lib/live.js` (MIT):

<!-- prettier-ignore -->
```js
  // The account the page has open is in its cookie.
  function usageUrl(cookie) {
    const org = /(?:^|; )lastActiveOrg=([0-9a-f-]{36})(?:;|$)/.exec(cookie || '')?.[1]
    return org ? `${ORIGIN}/api/organizations/${org}/usage` : null
  }

  function limitOf(label, window, now) {
    if (typeof window?.utilization !== 'number') return null
    const note = window.resets_at ? self.narsilState.resetLabel(Date.parse(window.resets_at) / 1000, now) : ''
    return { label, percent: Math.round(window.utilization), color: self.narsilState.levelColor(window.utilization), note }
  }

  const limitsOf = (usage, now) => [limitOf('5 horas', usage?.five_hour, now), limitOf('Semana', usage?.seven_day, now)].filter(Boolean)
```

1. **Which account.** The id of the organization the page has open is in the `lastActiveOrg` cookie, a 36-character UUID. The script reads it from `document.cookie` and keeps it nowhere.
2. **The usage.** It asks `claude.ai/api/organizations/<id>/usage`, an internal address of the page.
3. **Two windows.** From the answer it takes `five_hour` and `seven_day`: `utilization`, already a percent, and `resets_at`, a date. A window without a numeric `utilization` is left out.

The reset is worded by `resetLabel` in `lib/state.js`: `reinicia en 45 min`, `reinicia en 2 h 05 min` or `reinicia en 3 d 4 h`, and `ya se reinició` (already reset) once the time is past. The colors are the shared thresholds of `levelColor`: green below 60 %, amber from 60 %, red from 85 %.

`pollUsage` asks once when the page loads, then every 60 seconds, and never while the page is hidden. When the page becomes visible again, it asks at once. If the request fails, the last limits stay.

### The level and the count, from the mod through ntfy.sh

Your level and ntfy.sh's count live on your computer, in the mod. The mod sends them in its silent state topic, your topic with `-estado` (state) at the end. The app follows it in Kotlin while the page shows the band, keeps the newest state, and posts it to the page ([guide 3](/en/android/conversation-band/) walks through `StateFeed` and `StateModel`). The page never sees the topic.

The state carries more fields than the block uses. `sendStatus` in narsil-pet's `hooks/register.tsx` builds it with `xp`, `art`, `at`, `cacheMinutes`, `limits`, `sessions` and `usage`. The block reads three of them, and `at`:

- **`xp`**, a label such as `⭐ Nivel 28 · 30/2800 XP`, written by the mod's `xpLabel`. `levelOf` in `lib/state.js` splits it into the name, the points into the level and the points it needs, for the bar.
- **`art`**, the address of Narsil's picture at her stage. It is accepted only when it starts with narsil-pet's assets folder on GitHub. In light mode, the block swaps `-oscuro.png` for `-claro.png`, since the mod sends the dark variant.
- **`usage`**, one row with the key `ntfy`, built by the mod's `ntfyRow` in `hooks/phone.ts`: `{ key: 'ntfy', label: 'ntfy hoy', percent, color, note, resetsAt }`, where `note` reads like `24/250 mensajes` (24/250 messages).
- **`at`**, when the mod sent it, in seconds. It decides which state is newest, and how old the count is.

`limits` and `sessions` are for [Narsil Watch](/en/watch/what-it-is/), which has no `claude.ai` page to ask; the app takes its limits from the page instead. The two parsers, from `lib/state.js` (MIT):

<!-- prettier-ignore -->
```js
  // "⭐ Nivel 4 · 350/400 XP": the name, and how far into the level.
  function levelOf(xp) {
    const m = /^(.*?)\s*·\s*(\d+)\/(\d+)\s*XP/.exec(xp || '')
    if (!m) return null
    const [into, needed] = [Number(m[2]), Number(m[3])]
    return { name: `Narsil ${m[1]}`, into, needed, percent: Math.round((into / needed) * 100) }
  }

  function ntfyOf(s, now) {
    const row = Array.isArray(s.usage) ? s.usage.find((r) => r.key === 'ntfy') : null
    if (!row) return null
    const isStale = Boolean(s.at) && now - s.at > STALE_SECONDS
    const note = [row.note, row.resetsAt ? resetLabel(row.resetsAt, now) : '', isStale ? `dato de ${ago(s.at, now)}` : ''].filter(Boolean).join(' · ')
    return { label: row.label, percent: Math.round(row.percent), color: row.color, note }
  }
```

A level label that does not match the pattern gives `null`, and the head of the block, picture and all, stays hidden. That is also what you see before the mod has ever sent a state.

### Why the count has to come from the computer

ntfy.sh counts messages per IP address. The mod asks `https://ntfy.sh/v1/account` from your computer's network how many messages that network sent today, and puts the answer in its state, counting the message about to go. If the phone asked, ntfy.sh would answer about the phone's network, which sends nothing. As narsil-pet's comment explains, that day also starts "at an hour hashed from the IP, not at midnight", which is why the row shows its own reset time.

### "More than an hour old"

The mod sends a state only while you write from away, and caps itself at 200 messages a day. When you go back to the desk, the last state stays, and ages. So when a state is more than an hour old (`STALE_SECONDS = 3600`), the `ntfy hoy` row adds a note such as `dato de hace 3 h` (data from 3 h ago). The level gets no such note: it changes slowly, and an hour-old level is still your level.

### How the block is drawn

`renderBand` in `content.js` builds the block from the latest message the app posted and the latest limits. From `content.js` (MIT):

<!-- prettier-ignore -->
```js
  function renderBand() {
    const now = Date.now() / 1000
    const view = latest?.type === 'model' ? N.viewOf(latest.model, now) : null
    const notes = { sealed: '🔒 Toca y pon la clave' }
    const message = latest?.type === 'no-topic' ? 'Toca y escribe tu topic' : notes[view?.kind]
    notice.hidden = !message
    setText(notice, message || '')
    const level = view?.level
    head.hidden = !level
    if (level) {
      setPet(L.themedArt(view.art, document.documentElement.dataset.mode === 'light'))
      setText(levelName, level.name)
      setText(levelXp, `${level.into}/${level.needed} XP`)
      levelFill.style.width = `${Math.min(100, level.percent)}%`
    }
    meters.replaceChildren(...[...L.limitsOf(limits, now), ...(view?.ntfy ? [view.ntfy] : [])].map(meter))
  }
```

The meters are rebuilt each time with `replaceChildren`, out of elements made with `createElement` and filled with `textContent`. The head is updated in place with `setText`, which writes only when the text changed. It runs when a message arrives from the app, when new limits arrive, and every 15 seconds while the page is visible, so the reset times keep moving.

### The notices and the taps

`viewOf` in `lib/state.js` decides the notice from the model the app sent:

| The model                                   | `viewOf` gives | The block shows                              |
| ------------------------------------------- | -------------- | -------------------------------------------- |
| `{ type: 'no-topic' }` from the app         | (no model)     | `Toca y escribe tu topic`                    |
| No state, and the last message did not open | `sealed`       | `🔒 Toca y pon la clave`                     |
| No state, nothing sealed                    | `empty`        | Only the limits                              |
| A state                                     | `state`        | Narsil, her level, the limits and `ntfy hoy` |

Read the second and fourth rows together, because they hide a detail: the lock notice shows only when the model has **no state at all**. `StateModel.receive` marks the model `isSealed` when a message does not open, but keeps the state it had; and `viewOf` shows a state whenever there is one. So if Narsil was already showing and a new message arrives sealed with a key the app does not have, the block keeps showing the old level, with no lock. You see the lock on a fresh install, or after you change the topic.

Two taps open the settings, by two roads:

- **The notice** is a `<button>`. Its click handler sends `{ type: 'settings' }` on the band's port; `host.js` wraps it as `{ kind: 'port', message }`, and `MainActivity` opens `SettingsActivity` when the inner type is `settings`.
- **Narsil's picture or level.** `host.js` listens for clicks on the whole document, in the capture phase, and sends `{ kind: 'settings' }` when the target is inside `#narsil-band .narsil-head`. The commit `9e514dd` explains why both exist: "The launcher shortcut is not shown by every launcher, and the band's notice only shows without a topic."

### What a reader of your topic could do

Without a key, anyone who knows your topic can also publish on `<topic>-estado`. So nothing from it is trusted as markup: every value goes in with `textContent`, and a picture is shown only when its address starts with narsil-pet's own assets folder. The code's comment in `lib/state.js` says it: "its text only ever goes in as text, and an image only comes from Narsil's own assets." A forged state could show a wrong level or count. It cannot add a link, a script or a picture from elsewhere. It could also carry an `at` far in the future: every real state would then lose to it, and since the app saves the model per topic, ntfy.sh forgetting the message after 12 hours would not help. Changing the topic starts from an empty model, and so does clearing the app's data. [Guide 7](/en/android/encryption-and-settings/) explains how the key narrows this, and how far.

## Build it with Claude

Ask Claude for a block after the side menu's search button, fed from two sides: the page's own usage request, and the state the app posts. The one idea it must get right is that the page never holds the topic, and that nothing from ntfy.sh is trusted.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> In the page script my Android WebView runs on `https://claude.ai`, add a block right after the side menu's search button, found by its position (`.df-phone-sheet-header`, else `.dframe-nav-scroll > .shrink-0 > button`), not its text, and put it back whenever the page observer sees it moved. Every 60 seconds while the page is visible, read the organization id from the `lastActiveOrg` cookie and `GET /api/organizations/<id>/usage` with `credentials: 'include'`; show `five_hour` and `seven_day` as `5 horas` and `Semana`, with percent, a colored bar (green, amber from 60, red from 85) and the reset time. From the message the app posts, show the `xp` label split into level and points, a picture only from `https://raw.githubusercontent.com/davshn/narsil-pet/main/assets/`, and the `usage` row keyed `ntfy`, with "dato de hace N h" when `at` is over an hour old. Show a tappable notice when the app says there is no topic. Use `textContent` only. Keep the parsing in a module with no DOM and test it.

### What to check in Claude's answer

1. The search is found by its position, not by its text.
2. The organization id is read from the cookie each time and stored nowhere.
3. Limits are asked every 60 seconds, never while `document.hidden` is true, and at once when the page shows again.
4. The level label is parsed with a pattern, and a label that does not match hides the head instead of showing garbage.
5. A picture address must start with the one fixed prefix.
6. Everything goes in with `textContent` or as created elements, never as HTML.
7. The topic never appears in the page script.

If a check fails, tell Claude what you see: "with Claude in Spanish, the block does not appear".

### How the author asked for it

The owner's words recorded for this app ask for the extension's look and band in a web view (L1: "que dentro en un web view muestre la web de claude y modifique sus estilos como lo hace esta extension"), so the block came along unchanged. One later request is recorded only through its commit:

- `9e514dd` (2026-11-24) "feat: open the settings from Narsil in the band and from the service's notification". Its message is quoted above.

The task log records the check on the real phone, with the real topic and key, on 2026-11-24 at 00:44: "the band showed Narsil Nivel 28, 30/2800 XP, ntfy's count and her etapa4 art. Settings open from Narsil in the band and from the service's notification."

The rest is reconstructed from the commit history (a project name in a subject is replaced by a description in brackets):

- `3bcea35` (2026-11-24) "feat: build the script that hosts [the earlier extension] in a WebView, and what alerts and states keep".
- `53c55c1` (2026-11-24) "feat: host claude.ai with [the earlier extension] in a WebView, and show Narsil's alerts from a foreground service".
- `ca01cc7` (2026-11-24) "docs: log the band verified with a signed-in session".
- `a275382` (2026-11-24) "docs: log the alerts and the band verified with the real topic and key".

On the mod's side, narsil-pet's `6400a6f` (2026-11-23) "feat(phone): publish Claude limits and open conversations for the watch" added the `limits` and `sessions` fields that the block leaves to the watch.

## Reference code

This is one correct answer, written for this guide (MIT). Read it to understand how the pieces fit together and to compare it with what Claude wrote for you: Claude may choose other names or another order and still be right.

The limits as a pure module, in the shape of `lib/live.js`, with a test. Save it as `limits.js`.

```js
const colorOf = (percent) => (percent >= 85 ? '#F0435A' : percent >= 60 ? '#F5B400' : '#22B573')

export function usageUrl(cookie) {
  const org = /(?:^|; )lastActiveOrg=([0-9a-f-]{36})(?:;|$)/.exec(cookie || '')?.[1]
  return org ? `https://claude.ai/api/organizations/${org}/usage` : null
}

export function resetNote(resetsAt, now) {
  const left = Math.max(0, Math.round((resetsAt - now) / 60))
  if (left === 0) return 'ya se reinició'
  if (left < 60) return `reinicia en ${left} min`
  return `reinicia en ${Math.floor(left / 60)} h ${String(left % 60).padStart(2, '0')} min`
}

export function limitsOf(usage, now) {
  const rows = [
    ['5 horas', usage?.five_hour],
    ['Semana', usage?.seven_day],
  ]
  return rows
    .filter(([, window]) => typeof window?.utilization === 'number')
    .map(([label, window]) => ({
      label,
      percent: Math.round(window.utilization),
      color: colorOf(window.utilization),
      note: window.resets_at ? resetNote(Date.parse(window.resets_at) / 1000, now) : '',
    }))
}
```

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { limitsOf, usageUrl } from './limits.js'

test('the organization comes from the cookie, or there is no request', () => {
  const org = '00000000-0000-4000-8000-000000000000'
  assert.equal(
    usageUrl(`theme=dark; lastActiveOrg=${org}`),
    `https://claude.ai/api/organizations/${org}/usage`,
  )
  assert.equal(usageUrl('theme=dark'), null)
})

test('a window without a number is left out', () => {
  const now = Date.parse('2026-11-24T10:00:00Z') / 1000
  const usage = {
    five_hour: { utilization: 72.4, resets_at: '2026-11-24T12:05:00Z' },
    seven_day: null,
  }
  assert.deepEqual(limitsOf(usage, now), [
    { label: '5 horas', percent: 72, color: '#F5B400', note: 'reinicia en 2 h 05 min' },
  ])
})
```

The real `minutesLabel` also words days (`3 d 4 h`), which the weekly limit needs; this one stops at hours to stay short.

## Common mistakes and how to test it

- **Finding the search by its text.** The label changes with the page's language. Find it by its position.
- **Placing the block once.** The page mounts the side menu late, and again at times. Put the block back on every observer run.
- **Asking for limits while hidden.** A phone in a pocket would ask every minute for nothing.
- **Keeping the organization id.** It is in the cookie when you need it; there is no reason to store it.
- **Asking ntfy.sh for the count from the phone.** The answer is about the phone's network. The count has to come from the computer.
- **A count that never moves.** The mod sends its state only while you write through Remote Control. At the desk, the block keeps the last one and marks its age.
- **Expecting the lock after a key change.** If a state was already showing, a message the key cannot open leaves it there. Clear the doubt by sending `/narsil movil prueba` after you set the key: a new state that opens replaces the old one.

To test the parsing on the computer, run the module above with `node --test`, and read `levelOf`, `ntfyOf` and `viewOf` in `lib/state.js` with an invented state. On the phone, put an invented topic such as `narsil-0000000000example0` in the settings, then publish a state to its `-estado` topic from the computer ([ntfy: publishing](https://docs.ntfy.sh/publish/)):

```bash
curl -d '{"xp":"⭐ Nivel 2 · 40/200 XP","at":1700000000,"usage":[{"key":"ntfy","label":"ntfy hoy","percent":10,"color":"#22B573","note":"25/250 mensajes"}]}' https://ntfy.sh/narsil-0000000000example0-estado
```

Open the side menu: within a second it should show `Narsil ⭐ Nivel 2` with `40/200 XP`, and a `ntfy hoy` row at 10 % with `25/250 mensajes` and a `dato de hace …` note, since that `at` is long past. The limits should be there too, from `claude.ai`. Tap Narsil: the settings should open. Put your real topic back when you are done.

### Where the code and the README differ

- The README says that if the key is not the one that sealed the messages, the band says "🔒 Toca y pon la clave". The code shows it only when the app has no state for the topic yet; with an earlier state kept, the block goes on showing it, as explained above.
- The README places the settings tap on "The band in Claude's side menu". In the code, that element is indeed `#narsil-band`; the strip above the message box is `#narsil-event`, and a tap there only expands its text.

## Going further

- [Guide 5](/en/android/colors-and-mode/) dresses the whole page in Narsil's colors, and the block with it.
- [Guide 7](/en/android/encryption-and-settings/) explains the lock, the key, and the settings the block opens.
- On the mod's side, [Alerts on your phone and watch](/en/mods/pet/phone-and-watch/) describes the `-estado` fields, the daily limit of 200 and `ntfyRow`.
- [Narsil Watch](/en/watch/what-it-is/) reads the same state, including the `limits` and `sessions` fields the block leaves alone.
- The source is at [github.com/davshn/narsil-android](https://github.com/davshn/narsil-android).
