---
title: The band above the message box
description: "The band Narsil in Claude draws above claude.ai's message box: her pose, the state, the context, the cache countdown and the last event, all read from the page's own data."
route: claude
order: 2
updated: 2026-11-18
---

## What it does

When you open a conversation on `claude.ai/code`, a band appears just above the box where you write. From left to right and top to bottom it shows:

- **Narsil**, at her current stage and in the pose of the conversation's state.
- **The state**, as a colored chip: `TRABAJANDO` (working, blue), `TE NECESITA` (needs you, amber), `TERMINADA` (finished, green) or `EN REPOSO` (at rest, gray). The band's left edge takes the same color.
- **The context**, such as `Contexto 42 %`: how much of its window the conversation has used, in green, amber or red.
- **The cache**, such as `🧊 38 min`: the minutes left before the prompt cache expires, until it turns into `🧊 fría` ("cold").
- **The last event**: the last thing Claude said, or `Usando Bash` ("using Bash") when Claude is only running a tool, with how long ago, such as `hace 3 min`.

The text takes two lines. A tap opens it whole and another tap closes it. The band pushes the conversation up instead of covering it, and it refreshes every 10 seconds while the screen is visible.

> **Experimental.** The band reads the same data the `claude.ai` page loads for itself, from internal addresses that are not a public API, and finds the message box by the page's structure. A Claude update can break it; when it does, the band just stops showing. It only reads, and it never sends your data anywhere.

Everything in the band comes from `claude.ai` itself, so it needs no message from your computer. Only two details depend on [the narsil-pet mod](https://github.com/davshn/narsil-pet): Narsil's stage in the picture, and how long the cache lasts.

## How it works inside

The band is drawn by the content script `extension/content.js`. What it makes of the data lives in `extension/lib/live.js`, a module with no DOM code, which keeps the rules testable on their own.

### Where the data comes from: the page's own requests

The band does not read the conversation from the screen. It asks `claude.ai` the same questions the page asks, with your session, and reads the answers as JSON. Two requests go out together:

- **The list of your conversations**, active and paused, up to 50 (`/v1/code/sessions` on `claude.ai`). The band takes the one you have open, found by the id in the page's address (`/code/session_…`). The address and the list can name the same conversation with different prefixes, so the ids are compared without them.
- **The last 60 events of that conversation**, newest first (`/v1/code/sessions/<id>/events`).

These are internal addresses of `claude.ai`. The code says so above them: "These addresses are not a public API and may change." They are the main reason the extension is experimental.

To send the requests "as the page itself, with its session", the content script uses Firefox's `content.fetch` when it exists. MDN explains that in Firefox, with Manifest V2, `content.fetch()` makes "requests that behave as if they were sent by the content itself"; in Manifest V3 it is not available, and a content script's own `fetch` already runs in the page's context ([MDN: Content scripts, XHR and Fetch](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts#xhr_and_fetch)). So the Firefox extension uses `content.fetch` and the Chromium package for Vivaldi falls back to `fetch`. Both send your cookies (`credentials: 'include'`), so `claude.ai` answers as it answers the page. They are `GET` requests only, and the answers stay in the page.

### What each value is made of

`liveOf` in `lib/live.js` turns the conversation and its events into what the band shows:

| Value      | Made from                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------ |
| State      | The conversation's `status_bucket`: `working`, `blocked` or `completed`; anything else is `EN REPOSO`.       |
| Context    | `context_usage` in the conversation's metadata: tokens used over the window's maximum, rounded to a percent. |
| Last event | The newest message from Claude that has text; if it has only a tool call, `Usando` and the tool's name.      |
| When       | That message's time, as `ahora mismo`, `hace 5 min`, `hace 2 h` or `hace 1 d`.                               |
| Cache      | That same newest message from Claude, plus how long the cache lasts (below).                                 |

Two rules keep the last event useful. Thinking alone says nothing, so a message with no text and no tool is skipped. And only Claude's messages count: the conversation has many other kinds of events.

The context and the cache share one coloring: green below 60 %, amber from 60 %, red from 85 %, the same thresholds the sidebar's limits use. For the cache, the percent is how much of its time has passed.

### Narsil's picture: the pose from the page, the stage from the mod

The pose follows the state: working, needing you, finished, or standing at rest. Her stage is not something `claude.ai` knows. It comes from the mod: the status narsil-pet sends through ntfy.sh carries the address of her picture, and her stage is the folder in that address ([Experience and growth](/en/mods/pet/experience-and-growth/) explains the stages). The band keeps the stage from it, puts in the pose of this conversation, and picks the light or dark variant to match the page.

Pictures are accepted only from narsil-pet's own assets on GitHub. When there is no status from the mod, or a picture fails to load, the band shows the extension's own icon instead, and a picture that failed is not asked for again.

### Why the cache is an estimate

`claude.ai` does not say when a conversation's cache expires, so the band estimates it: **the time of Claude's last message plus how long a cache lasts**.

- **From Claude's last message**, not from the conversation's last event. The commit that added the band explains why: "as any event moves the session's own time". The code adds that opening the page makes some events of its own, which would reset the countdown every time you look.
- **How long it lasts** is for the mod to know: narsil-pet sends `cacheMinutes` in its status ([The cache clock](/en/mods/pet/cache-clock/) explains how it decides between 60 and 5 minutes). Without that value, the band assumes 60 minutes.

So the countdown can be off: the cache really starts from the request, not from the message, and without the mod a 5-minute cache shows as 60. Read `🧊 38 min` as "about 38 minutes".

### Every 10 seconds, only while you look

The band asks for new data every 10 seconds, and not at all while the page is hidden (the screen off, another app or another tab in front). When the page becomes visible again, it asks at once, using the [`visibilitychange`](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event) event. Between requests, it redraws every 15 seconds, so the countdown and the "hace" time keep moving. If a request fails, what it last knew stays until the next one.

### In the page's flow, so it covers nothing

The band is not a floating layer. It is a normal element inserted just before the message box, as its previous sibling. The message box is found by an attribute the page puts on it. Since the band is part of the page's own layout, the conversation above simply ends a little higher; nothing is hidden behind it.

The text is clamped to two lines with CSS ([`line-clamp`](https://developer.mozilla.org/en-US/docs/Web/CSS/line-clamp)). A tap toggles a class that removes the clamp and lets the text scroll inside a box of at most 40 % of the screen's height. All text goes in with `textContent`, never as HTML.

### Following the page as it changes

`claude.ai` is a single-page app: opening another conversation changes the address and the content without loading a new page, and the page rebuilds the message box at times. So the band cannot be placed once.

`extension/lib/watch.js` holds the extension's only [`MutationObserver`](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver), watching the whole document. While Claude writes, the page changes many times per frame, so the observer does not run its callbacks on each change: it schedules them once per frame with [`requestAnimationFrame`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame). On each run, the band checks two things:

- **Is it still just above the message box?** If not, it goes back there.
- **Is this still the same conversation?** The band compares the id in the address with the one it last asked about. When it changes, the old data is dropped, the band disappears, and new data is requested at once.

The band writes a value only when it changed, since each write of its own is one more change for the observer. And the observer stops, with everything that used it, once the extension is removed or reloaded, so an orphaned copy does not keep drawing.

## How it was asked of the AI

No request for the band was recorded. The owner's words recorded for this path are about the site ([guide 1](/en/mods/claude/what-it-is/) quotes them). The following is reconstructed from the extension's commit history:

- `c200e8a` (2026-11-09) "feat: show Narsil's state in claude.ai's sidebar on Firefox for Android". The first version showed the conversations in a panel in the side menu, fed by the mod through ntfy.sh.
- `19677ac` (2026-11-09) "feat: show each conversation's state, context and cache above the prompt". The band is born. Its message describes it as "read from the same addresses claude.ai uses, so it needs no message from the PC", and explains the cache rule quoted above.
- `00adbb9` (2026-11-09) "feat: show only Narsil's level, the limits and ntfy's count in the sidebar". The panel and its alerts were removed, "as each conversation's strip covers them".
- `ce7d17e` (2026-11-11) "perf: lighten the styles and the page observers so claude.ai switches conversations faster". The single observer, throttled to one run per frame.
- `1d9db3d` (2026-11-11) "fix: load the page observer with the band and stop when the extension goes away".

The history shows a move from data sent by the computer to data the page already had: the band works the moment you open a conversation, even with the computer off.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> In my Firefox extension for `https://claude.ai/*`, add a content script that draws a status band just before the page's message box, as its previous sibling, so it pushes the conversation up instead of covering it. Find the conversation id in `location.pathname`. Every 10 seconds, and only while `document.hidden` is false, read the conversation's data with the page's own session (`content.fetch` when it exists, otherwise `fetch`, with `credentials: 'include'`), `GET` only. Show the state, the context percent, the last text Claude wrote and how long ago, and a cache countdown estimated from the time of Claude's last message plus 60 minutes. Use one `MutationObserver` on the document, throttled with `requestAnimationFrame`, to put the band back when the page rebuilds and to reset it when the conversation changes. Write text only with `textContent`. Clamp the text to two lines and let a tap expand it. Keep the rules in a module with no DOM code, and test them with `node --test`.

## The minimal code

A small content script of the same shape, written for this guide (MIT). `readConversation` stands for whatever reads your data; here it returns the time of Claude's last message, in seconds. The rest is the band's mechanics: placing it, following the page, refreshing while visible and estimating the cache.

```js
const BOX = '[data-cds=ChatComposer]'
const CACHE_MINUTES = 60
const band = document.createElement('div')
band.id = 'my-band'
const text = document.createElement('span')
band.append(text)
band.addEventListener('click', () => band.classList.toggle('open'))

let lastSaidAt = null

function cacheLabel(saidAt, now) {
  const left = Math.ceil((saidAt + CACHE_MINUTES * 60 - now) / 60)
  return left > 0 ? `🧊 ${left} min` : '🧊 cold'
}

function draw() {
  const box = document.querySelector(BOX)
  if (!box || lastSaidAt === null) {
    band.remove()
    return
  }
  const label = cacheLabel(lastSaidAt, Date.now() / 1000)
  if (text.textContent !== label) text.textContent = label
  if (box.previousElementSibling !== band) box.before(band)
}

async function refresh() {
  if (document.hidden) return
  try {
    lastSaidAt = await readConversation(location.pathname)
  } catch {
    return
  }
  draw()
}

let queued = false
new MutationObserver(() => {
  if (queued) return
  queued = true
  requestAnimationFrame(() => {
    queued = false
    draw()
  })
}).observe(document.documentElement, { childList: true, subtree: true })

document.addEventListener('visibilitychange', refresh)
setInterval(refresh, 10_000)
refresh()
```

The CSS for the two lines and the tap:

```css
#my-band span {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

#my-band.open span {
  display: block;
  max-height: 40dvh;
  overflow-y: auto;
}
```

`BOX` is the attribute `claude.ai` puts on its message box today; if Claude renames it, this is the line that breaks. Comparing `box.previousElementSibling` before calling [`before()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/before) matters: moving the band on every frame would be a change of its own, and the observer would wake again.

## Common mistakes and how to test it

- **An observer per feature.** Several observers on a page that changes many times per frame add up. Use one, and run its work at most once per frame.
- **Writing on every run.** Setting `textContent` or moving the band when nothing changed triggers the observer again. Compare first.
- **A floating band.** A `position: fixed` band covers the last lines of the conversation and the buttons Claude shows there. Insert it in the page's flow.
- **Requests while hidden.** A phone with the screen off would keep asking every 10 seconds. Check `document.hidden` and listen for `visibilitychange`.
- **The cache from the last event.** Opening the page creates events, so counting from the last one resets the countdown each time you look. Count from Claude's last message.
- **Text as HTML.** Claude's messages can contain anything. Use `textContent`, never `innerHTML`.
- **Not resetting on a new conversation.** Without comparing the id in the address, the band shows the previous conversation's data for up to 10 seconds.

To test the rules, keep them in a module with no DOM, as `lib/live.js` does, and feed them made-up events: a list where the newest message from Claude has only a tool call should give `Usando` and the tool's name, and a message 61 minutes old should give the cold cache. To test the band itself, open a conversation, switch to another one and back, rotate the phone, and turn the screen off and on: the band should stay above the message box, change with the conversation, and update within 10 seconds of the screen coming back.

## Going further

- [Guide 3](/en/mods/claude/sidebar/) covers the block in the side menu, which adds what the page cannot know.
- Inside Claude Code, Narsil shows the same states with her own rules: see [The cache clock](/en/mods/pet/cache-clock/) and [Context and limits](/en/mods/pet/context-and-limits/).
- The band could tell you when the cache is about to go cold. It would need the real cache duration, which is why the extension takes it from the mod when it can.
