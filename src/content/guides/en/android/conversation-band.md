---
title: The band above the message box
description: 'The strip above the box where you write in the app: state, context, cache and last event from claude.ai itself, and Narsil at her stage from the mod state that StateFeed follows.'
route: android
order: 3
updated: 2026-11-24
sources:
  - repo: android
    path: app/src/main/assets/page/content.js
  - repo: android
    path: app/src/main/assets/page/lib/live.js
  - repo: android
    path: app/src/main/assets/page/lib/watch.js
  - repo: android
    path: app/src/main/assets/page/lib/restore.js
  - repo: android
    path: app/src/main/assets/page/band.css
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/StateFeed.kt
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/StateModel.kt
---

## What it does

When you open a conversation in the app (an address such as `claude.ai/code/session_…`), a strip appears just above the box where you write. From left to right and top to bottom it shows:

- **Narsil**, at her current stage and in the pose of the conversation's state.
- **The state**, as a colored chip: `TRABAJANDO` (working, blue), `TE NECESITA` (needs you, amber), `TERMINADA` (done, green) or `EN REPOSO` (at rest, gray). The strip's left edge takes the same color.
- **The context**, such as `Contexto 42 %`: how much of its window the conversation has used, in green, amber or red.
- **The cache**, such as `🧊 38 min`: the minutes left before the prompt cache expires, until it turns into `🧊 fría` (cold).
- **The last event**: the last thing Claude said, or `Usando Bash` (using Bash) when Claude is only running a tool, and how long ago, such as `hace 3 min` (3 min ago).

The text takes two lines. A tap on the strip opens it whole, and another tap closes it. The strip pushes the conversation up instead of covering it, and it refreshes every 10 seconds while the app is in front.

> **Experimental.** The strip reads the same data the `claude.ai` page loads for itself, from internal addresses that are not a public API, and finds the message box by an attribute in the page's markup. A Claude update can break it; when it does, the strip just stops showing and Claude keeps working. It only reads: it sends `GET` requests to `claude.ai` with your session and never writes to your account.

Almost everything in the strip comes from `claude.ai` itself, so it works the moment you open a conversation, even with your computer off. Only two details depend on the Narsil mod: her stage in the picture, and how long the cache lasts. Those come from `<your topic>-estado`, which the app follows in Kotlin.

## How it works inside

The strip is drawn by `assets/page/content.js`. What it makes of the data lives in `assets/page/lib/live.js`, a module with no DOM code. The page observer is `lib/watch.js`, the styles are in `band.css`, and the mod's state reaches the page from `StateFeed.kt` and `StateModel.kt` through the channel [guide 2](/en/android/webview-host/) describes.

These scripts were first written for the earlier browser extension, and most of their code is unchanged. In the app, they run in the page's own JavaScript world rather than in an extension's separate one: `addDocumentStartJavaScript` puts them next to `claude.ai`'s code. That changes one detail below, the `fetch` they use, and nothing in what they show.

### Where the data comes from: two sources

| Value in the strip      | Source                                                                     |
| ----------------------- | -------------------------------------------------------------------------- |
| State                   | `claude.ai`: the conversation's `status_bucket`                            |
| Context                 | `claude.ai`: `context_usage` in the conversation's metadata                |
| Last event and its time | `claude.ai`: the conversation's newest events                              |
| Cache countdown         | `claude.ai` for when Claude last spoke; the mod for how long a cache lasts |
| Narsil's pose           | `claude.ai`: the state picks it                                            |
| Narsil's stage          | The mod: the folder of the picture in its last state                       |

### The page's own requests

The strip does not read the conversation from the screen. It asks `claude.ai` the same questions the page asks, with your session, and reads the answers as JSON. Every 10 seconds, two requests go out together:

- **The list of your conversations**, active and paused, up to 50: `/v1/code/sessions?statuses=active&statuses=paused&limit=50`. The strip takes the one you have open, found by the id in the page's address (`/code/session_…`). The address and the list can name the same conversation with different prefixes (`session_x` and `cse_x`, says the code), so ids are compared without them.
- **The last 60 events of that conversation**, newest first: `/v1/code/sessions/<id>/events?limit=60&sort_order=desc`.

The comment above them in `lib/live.js` is the reason this path is experimental: "These addresses are not a public API and may change."

`content.js` sends them with `credentials: 'include'` and an `anthropic-version: 2023-06-01` header. In the earlier extension, it preferred Firefox's `content.fetch`, which makes requests "as the page itself, with its session", in the code's words. A WebView has no `content` object, so the code falls back to `fetch`, and since the script runs in the page's world, that is the page's own `fetch`, with the page's cookies. Your session never leaves `claude.ai`, and the answers stay in the page.

### What each value is made of

`liveOf` in `lib/live.js` turns the conversation and its events into what the strip shows. This excerpt is from `lib/live.js` in narsil-android (MIT):

<!-- prettier-ignore -->
```js
  const STATES = {
    working: { label: 'TRABAJANDO', color: '#3B8BFF' },
    blocked: { label: 'TE NECESITA', color: '#F5B400' },
    completed: { label: 'TERMINADA', color: '#22B573' },
  }
  const AT_REST = { label: 'EN REPOSO', color: '#8A90A6' }
```

| Value      | Made from                                                                                                       |
| ---------- | --------------------------------------------------------------------------------------------------------------- |
| State      | `status_bucket`: `working`, `blocked` or `completed`; anything else is `EN REPOSO`.                             |
| Context    | `external_metadata.context_usage`: `used_tokens` over `max_tokens`, rounded to a percent.                       |
| Last event | The newest event from Claude (`assistant`) with text; if it has only a tool call, `Usando` and the tool's name. |
| When       | That event's time, as `ahora mismo` (just now), `hace 5 min`, `hace 2 h` or `hace 1 d`.                         |
| Cache      | The newest event from Claude, plus how long a cache lasts (below).                                              |

Two rules keep the last event useful. Thinking alone says nothing, so an event with no text and no tool call is skipped. And only Claude's events count: a conversation has many other kinds.

The context and the cache share one coloring, from `levelColor` in `lib/state.js`: green below 60 %, amber from 60 %, red from 85 %. For the cache, the percent is how much of its time has passed.

### Why the cache is an estimate

`claude.ai` does not say when a conversation's cache expires, so the strip estimates it: **the time of Claude's last event plus how long a cache lasts**. From `lib/live.js` (MIT):

<!-- prettier-ignore -->
```js
  // From the model's last message: the session's last event may be anything,
  // and opening the page makes some of its own.
  function cacheOf(events, cacheMinutes, now) {
    const last = events.find((e) => e.event_type === 'assistant')
    if (!last) return null
    const left = Math.max(0, Math.ceil((secondsOf(last) + cacheMinutes * 60 - now) / 60))
    return { text: left > 0 ? `🧊 ${left} min` : '🧊 fría', color: self.narsilState.levelColor(100 - (left / cacheMinutes) * 100) }
  }
```

The start is Claude's last event, not the conversation's last event, because, as the comment says, opening the page makes events of its own, and the countdown would start over each time you looked.

How long a cache lasts is the mod's to know: `cacheMinutesOf` takes `cacheMinutes` from the mod's last state ([The cache clock](/en/mods/pet/cache-clock/) explains how the mod decides). Without a state, it assumes 60 minutes, "an hour on a plan", in the code's words. So read `🧊 38 min` as "about 38 minutes": the cache really starts at the request, not at the reply, and without the mod a 5-minute cache shows as 60.

### Narsil's picture: the pose from the page, the stage from the mod

The pose follows the state: `trabajando` (working), `necesita` (needs you), `terminado` (done), or `parada` (standing) at rest. Her stage is not something `claude.ai` knows. It comes from the mod's state, whose `art` field holds the address of her picture. From `lib/live.js` (MIT):

<!-- prettier-ignore -->
```js
  // Her stage is the mod's to know: it comes in the art of its last state,
  // with the first stage at the root and each later one in its folder.
  function petOf(bucket, sentArt, isLight) {
    if (typeof sentArt !== 'string' || !sentArt.startsWith(ART)) return null
    const stage = /^etapa\d+\//.exec(sentArt.slice(ART.length))?.[0] ?? ''
    return `${ART}${stage}${POSES[bucket] ?? 'parada'}-${isLight ? 'claro' : 'oscuro'}.png`
  }
```

`ART` is `https://raw.githubusercontent.com/davshn/narsil-pet/main/assets/`. The strip keeps only the stage folder (`etapa4/`, for example) from the mod's address, puts in this conversation's pose, and picks `-claro` (light) or `-oscuro` (dark) to match the page's mode. An address from anywhere else is refused, so a forged state cannot make the strip load a picture from another site.

When there is no state from the mod, or a picture fails to load, the strip shows the app's own icon instead, served from `https://claude.ai/__narsil__/page/icons/icon-192.png`. A picture that failed is not asked for again.

### From `<topic>-estado` to the page: `StateFeed` and `StateModel`

In the extension, a background script read ntfy.sh. In the app, Kotlin does, and only while a page shows the band. When `content.js` opens its port, `host.js` sends `connect`, and `MainActivity` calls `StateFeed.start()`. From `StateFeed.kt` in narsil-android (MIT):

```kotlin
    @Synchronized
    fun start() {
        stop()
        val mine = run
        val topic = settings.topic
        if (topic == null) {
            post(JSONObject().put("type", "no-topic").toString())
            return
        }
        val key = settings.key
        model = settings.model(topic) ?: StateModel.empty()
        send()
        stream = NtfyStream(NtfyStream.topicUrl("$topic-estado"), "12h") { raw ->
            synchronized(this) {
                if (mine != run) return@synchronized
                model = StateModel.receive(model, raw, key)
                settings.saveModel(topic, model)
                send()
            }
        }.also { it.start() }
    }
```

Step by step:

1. **No topic, no feed.** The page gets `{ type: 'no-topic' }`, and the side-menu block asks you to tap and write one.
2. **The last known state, at once.** The app keeps the band's last model per topic in its settings, so a page that opens later shows Narsil immediately, before ntfy.sh answers.
3. **Then the stream**, `https://ntfy.sh/<topic>-estado/json?since=12h`: what ntfy.sh kept of the last 12 hours first, then each new state as it comes. `NtfyStream` is the same class the alerts use; [guide 6](/en/android/alerts-service/) explains its reconnects.
4. **Each message** goes through `StateModel.receive`, is saved, and is posted to the page as `{ type: 'model', model }`.

The `run` counter guards against a race: if the page disconnects and connects again while a message is in flight, the old stream's message is dropped. When the page is hidden, the band closes its port, `host.js` sends `disconnect`, and the stream stops. Nothing is read from ntfy.sh while you are not looking at Claude.

`StateModel.receive` keeps only the newest state. From `StateModel.kt` (MIT):

```kotlin
    fun receive(model: JSONObject, raw: JSONObject, key: String?): JSONObject {
        if (raw.optString("event") != "message") return model
        val m = Seal.unseal(key, raw)
        if (m.optBoolean("sealed")) return JSONObject(model.toString()).put("isSealed", true)
        val state = try {
            JSONObject(m.optString("message"))
        } catch (_: JSONException) {
            return model
        }
        val kept = model.optJSONObject("state")?.optDouble("at", 0.0) ?: 0.0
        if (kept > state.optDouble("at", 0.0)) return model
        return JSONObject().put("state", state).put("isSealed", false)
    }
```

Keepalives and other events are ignored. A sealed message is opened with the key; if it does not open, the model is marked `isSealed` and keeps whatever state it had. A message that is not a JSON object is ignored. And a state older than the kept one (by its `at` field, in seconds) loses, so replaying 12 hours on every connect never moves the band backwards. `StateModelTest.kt` checks each of these cases. [Guide 7](/en/android/encryption-and-settings/) covers what the lock notice means.

### Every 10 seconds, only while you look

`content.js` asks for new data every 10 seconds, and not at all while the page is hidden: another app in front, the screen off, or the app's settings open. When the page becomes visible again, it asks at once, from the [`visibilitychange`](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event) event, and opens its port again, which starts a fresh `StateFeed` with the current topic and key. That is why a key you just typed in the settings takes effect as soon as you come back. Between requests the strip redraws every 15 seconds, so the countdown and the `hace` time keep moving. If a request fails, what it last knew stays until the next one.

### In the page's flow, so it covers nothing

The strip is not a floating layer. It is a normal element, `#narsil-event`, inserted just before the message box, found by the attribute `[data-cds=ChatComposer]` the page puts on it. Since it is part of the page's own layout, the conversation above simply ends a little higher.

`band.css` starts each of Narsil's parts with `all: initial`, so none of `claude.ai`'s styles leak in, and sets its own colors as variables, with a light set under `html[data-mode="light"]`. It also undoes one rule of Narsil's own skin: [guide 5](/en/android/colors-and-mode/) makes all of Claude's text bold, and the band sets its weights back with `!important`. The text is clamped to two lines with [`line-clamp`](https://developer.mozilla.org/en-US/docs/Web/CSS/line-clamp); a tap toggles `narsil-open`, which lets it scroll inside at most 40 % of the screen's height (`40dvh`). All text goes in with `textContent`, never as HTML.

### Following the page as it changes

`claude.ai` is a single-page app: opening another conversation changes the address and the content without loading a new page, and the page rebuilds the message box at times. So the strip cannot be placed once.

`lib/watch.js` holds the only [`MutationObserver`](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver) for all of Narsil's scripts, watching the whole document. While Claude writes, the page changes many times per frame, so it runs its callbacks at most once per frame, with [`requestAnimationFrame`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame). On each run, the strip checks two things:

- **Is it still just above the message box?** If not, it goes back there.
- **Is this still the same conversation?** It compares the id in the address with the one it last asked about. When it changes, the old data is dropped, the strip disappears, and new data is requested at once.

It writes a value only when it changed, since each write of its own is one more change for the observer.

Two parts of these scripts are leftovers from the extension that do little in the app. The observer stops itself when its extension goes away, by checking `browser.runtime.id`; `host.js` always answers `'narsil-android'`, so in the app it never stops for that reason. And `lib/restore.js` existed to put scripts and styles back after Vivaldi on Android dropped them. In the app only one part of it runs: `missingStyles`, which checks the marks `--narsil-css-skin` and `--narsil-css-band` that each stylesheet sets on `:root`. If one is missing, `content.js` sends `narsil-missing`, and `host.js` adopts the stylesheet again.

### Tapping the strip, and tapping Narsil

A tap on the strip only opens or closes its text. The tap that opens the app's settings is on Narsil in the side-menu block, `#narsil-band .narsil-head` in `host.js`; [guide 4](/en/android/sidebar/) shows it. The names can mislead: in the code, `narsil-band` is the side-menu block, and this strip is `narsil-event`.

## Build it with Claude

Ask Claude for the two halves at once: a page script that draws a strip above the message box from `claude.ai`'s own data, and a Kotlin feed that sends it the mod's state over the WebView channel. The one idea it must get right is that the page only reads, only while you look, and that the state reaching it is the newest one, already opened.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> My Android app hosts `https://claude.ai` in a WebView and runs a page script at document start, with a channel `myHost` to Kotlin. In the page script, draw a strip just before `[data-cds=ChatComposer]`, as its previous sibling. Take the conversation id from `location.pathname` (`/code/session_…`). Every 10 seconds, and only while `document.hidden` is false, `GET` the conversation list and its last 60 events with `fetch` and `credentials: 'include'`. Show the state from `status_bucket`, the context percent, the last text Claude wrote and how long ago, and a cache countdown from the time of Claude's last event plus a number of minutes the app sends. Use one `MutationObserver` throttled with `requestAnimationFrame`. Write text only with `textContent`. In Kotlin, when the page says `connect`, follow `https://ntfy.sh/<topic>-estado/json?since=12h` on a background thread, keep only the message with the highest `at`, save it, and post it to the page; stop on `disconnect`. Keep the rules in pure modules and test them.

### What to check in Claude's answer

1. The strip is inserted just before the message box, not as a `position: fixed` layer.
2. Requests are `GET` only, with `credentials: 'include'`, and none go out while `document.hidden` is true.
3. The cache countdown starts from Claude's last event, not from the conversation's last event.
4. The Kotlin side keeps the newer of two states by `at`, so replaying the last 12 hours never moves the strip backwards.
5. A picture address is accepted only from one fixed prefix, and only the stage folder is taken from it.
6. The feed stops when the page disconnects or a new page starts loading, and a late message from an old stream is dropped.

If a check fails, tell Claude what you see: "after I switch conversations, the strip shows the old one's text for a few seconds".

### How the author asked for it

The owner's words for this app are recorded in `odd/tasks/android-app.md`. L1 asked for a web view that "muestre la web de claude y modifique sus estilos como lo hace esta extension" (shows Claude's web and changes its styles the way this extension does), and L3 that the styles be the extension's own. So the strip was not redesigned for the app: the request was to bring the extension's band along unchanged.

The task log also records how it was checked on a real phone, signed in: "With a state published to the throwaway topic's -estado, the sidebar band showed level, XP, ntfy's count and Narsil's art from raw.githubusercontent.com (the page's CSP lets it load), and the strip above the composer showed TRABAJANDO, context, cache and her pose."

The rest is reconstructed from the commit history (a project name in a subject is replaced by a description in brackets):

- `3bcea35` (2026-11-24) "feat: build the script that hosts [the earlier extension] in a WebView, and what alerts and states keep". `StateModel` and the page scripts arrive.
- `53c55c1` (2026-11-24) "feat: host claude.ai with [the earlier extension] in a WebView, and show Narsil's alerts from a foreground service". Its message: "The band's state follows <topic>-estado while the band shows".
- `ca01cc7` (2026-11-24) "docs: log the band verified with a signed-in session".
- `5ad4577` (2026-11-24) "refactor: make the band's scripts the app's own, and stop naming the projects it replaces".

## Reference code

This is one correct answer, written for this guide (MIT). Read it to understand how the pieces fit together and to compare it with what Claude wrote for you: Claude may choose other names or another order and still be right.

The strip's rules as a pure module, with no DOM, in the shape of `lib/live.js`. It takes the conversation, its events (newest first) and the cache length, and returns what to show.

```js
const STATES = {
  working: { label: 'TRABAJANDO', color: '#3B8BFF' },
  blocked: { label: 'TE NECESITA', color: '#F5B400' },
  completed: { label: 'TERMINADA', color: '#22B573' },
}
const AT_REST = { label: 'EN REPOSO', color: '#8A90A6' }

const secondsOf = (event) => Date.parse(event.created_at) / 1000

export function stripOf(session, events, cacheMinutes, now) {
  const said = events.find((event) => event.event_type === 'assistant')
  const blocks = Array.isArray(said?.payload?.message?.content) ? said.payload.message.content : []
  const words = blocks
    .filter((block) => block.type === 'text' && block.text?.trim())
    .map((block) => block.text.trim())
    .join('\n')
  const tool = blocks.filter((block) => block.type === 'tool_use').pop()
  const left = said
    ? Math.max(0, Math.ceil((secondsOf(said) + cacheMinutes * 60 - now) / 60))
    : null
  return {
    ...(STATES[session.status_bucket] ?? AT_REST),
    text: words || (tool ? `Usando ${tool.name}` : ''),
    cache: left === null ? '' : left > 0 ? `🧊 ${left} min` : '🧊 fría',
  }
}
```

It is simpler than the real one on purpose: it reads only Claude's newest event, while `lastSaid` in `lib/live.js` walks back past events that hold only thinking. Save it as `strip.js`. A test for it with `node --test`, also written for this guide:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { stripOf } from './strip.js'

const at = (iso, content) => ({
  event_type: 'assistant',
  created_at: iso,
  payload: { message: { content } },
})

test('a tool call alone says what Claude is using', () => {
  const now = Date.parse('2026-11-24T10:10:00Z') / 1000
  const events = [at('2026-11-24T10:00:00Z', [{ type: 'tool_use', name: 'Bash' }])]
  const strip = stripOf({ status_bucket: 'working' }, events, 60, now)
  assert.equal(strip.label, 'TRABAJANDO')
  assert.equal(strip.text, 'Usando Bash')
  assert.equal(strip.cache, '🧊 50 min')
})

test('an hour and a minute later the cache is cold', () => {
  const now = Date.parse('2026-11-24T11:01:00Z') / 1000
  const events = [at('2026-11-24T10:00:00Z', [{ type: 'text', text: 'Listo.' }])]
  assert.equal(stripOf({ status_bucket: 'completed' }, events, 60, now).cache, '🧊 fría')
})
```

## Common mistakes and how to test it

- **An observer per feature.** Several observers on a page that changes many times per frame add up. Use one, and run its work at most once per frame.
- **Writing on every run.** Setting `textContent` or moving the strip when nothing changed wakes the observer again. Compare first.
- **A floating strip.** A `position: fixed` strip covers the last lines of the conversation and the buttons Claude shows there.
- **Requests while hidden.** A phone with the screen off would keep asking every 10 seconds. Check `document.hidden`.
- **The cache from the last event.** Opening the page creates events, so counting from the last one resets the countdown each time you look.
- **The last state, not the newest.** Every connect replays 12 hours, oldest first, on top of a saved state that may be newer. Compare `at`.
- **Text as HTML.** Claude's messages, and anything on an ntfy.sh topic, can contain anything. Use `textContent`.
- **Expecting the strip on Claude's home page.** It shows only on a conversation's page, with the message box present.

To test the rules on the computer, keep them in modules with no DOM, as `lib/live.js` does, and feed them invented events, as in the reference code. On the Kotlin side, `./gradlew testDebugUnitTest` runs `StateModelTest`, which checks that a state is kept, that the newer of two wins, that keepalives and non-JSON messages are ignored, and that a sealed state the key cannot open is marked.

On the phone, publish an invented state to a test topic you put in the settings, from the computer:

```bash
curl -d '{"xp":"⭐ Nivel 3 · 40/300 XP","art":"https://raw.githubusercontent.com/davshn/narsil-pet/main/assets/etapa3/parada-oscuro.png","at":1795000000,"cacheMinutes":5}' https://ntfy.sh/narsil-0000000000example0-estado
```

Open a conversation: within a second the strip's Narsil should show stage 3 in the conversation's pose, and the cache should count down from 5 minutes after Claude's last reply. Then switch conversations, rotate the phone and turn the screen off and on: the strip should stay above the message box, change with the conversation, and update within 10 seconds of coming back.

### Where the code and the README differ

- The comments in `band.css` and `lib/state.js` still describe the extension: "A stylesheet of the manifest's, not a `<style>` the script adds", and "the background page loads it after seal.js". In the app there is no manifest, no background page and no `seal.js`: the stylesheet goes on as a constructed sheet from `host.js`, and Kotlin opens sealed states. The code behaves as this guide describes; only those comments are stale.

## Going further

- [Guide 4](/en/android/sidebar/) covers the block in the side menu, where a tap on Narsil opens the settings.
- [Guide 6](/en/android/alerts-service/) explains `NtfyStream`, the class that follows `-estado` here and your topic for the alerts.
- Inside Claude Code, Narsil shows the same states with her own rules: see [The cache clock](/en/mods/pet/cache-clock/) and [Alerts on your phone and watch](/en/mods/pet/phone-and-watch/) for the `-estado` fields.
- The same state also reaches a watch: [Narsil Watch](/en/watch/what-it-is/).
- The source is at [github.com/davshn/narsil-android](https://github.com/davshn/narsil-android).
