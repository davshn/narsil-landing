---
title: The block in the side menu
description: "The block under Search in claude.ai's side menu: Narsil's level and the day's ntfy count from the mod through ntfy.sh, and the 5-hour and weekly limits from claude.ai itself."
route: claude
order: 3
updated: 2026-11-18
---

## What it does

Open the side menu on `claude.ai` and, just under **Search**, Narsil in Claude adds a block with three kinds of data:

| What                                                         | Where it comes from                 |
| ------------------------------------------------------------ | ----------------------------------- |
| **Narsil**, her level and her experience, with a bar         | The narsil-pet mod, through ntfy.sh |
| **`5 horas`** and **`Semana`**: the 5-hour and weekly limits | `claude.ai` itself, every minute    |
| **`ntfy hoy`**: the day's ntfy.sh messages and their reset   | The narsil-pet mod, through ntfy.sh |

Each limit shows a percent, a bar in green, amber or red, and when it resets, such as `reinicia en 2 h 05 min` ("resets in 2 h 05 min"). The level reads like `Narsil ⭐ Nivel 4` with `350/400 XP` beside it.

ntfy.sh is used only for what the page cannot know. The level and the count change when the mod sends a status, which is when you write to Claude Code through Remote Control. When the count is more than an hour old, the block says so.

> **Experimental.** The block finds its place by the structure of the `claude.ai` side menu, and reads the limits from an internal address of the page, not from a public API. A Claude update can break it; when it does, the block stops showing. It only reads, and it never sends your data anywhere.

## How it works inside

The block is drawn by `extension/content.js`, like the band of [guide 2](/en/mods/claude/conversation-band/). The limits are read by the content script itself, from the page. The level and the count are read by the background script, `extension/background.js`, with the help of `lib/stream.js` and `lib/seal.js`, and kept and shaped by `lib/state.js`.

### Finding Search in any language

The block is not found by the word "Search", which changes with the page's language. It is found by where Search sits: on a phone, the side menu is a sheet with Search in its header; on a wider screen, Search is the only direct button of the menu's first group. The block is inserted right after it.

The page mounts the side menu late, and mounts it again at times, so the block is put back by the same page observer the band uses: on each run, if it is not right after Search, it goes there.

### The limits, from `claude.ai` every minute

The 5-hour and weekly limits are your account's, and `claude.ai` already knows them. The content script reads them the same way the band reads a conversation, with the page's session and a `GET` request:

1. **Which account.** The id of the organization the page has open is in one of the page's cookies, `lastActiveOrg`. The content script reads it from `document.cookie` and never stores it.
2. **The usage.** It asks `claude.ai` for that organization's usage, an internal address of the page.
3. **Two windows.** From the answer it takes the 5-hour window and the 7-day window: how much is used, as a percent, and when each one resets.

It asks once when the page loads, then every 60 seconds, and never while the page is hidden. When the page becomes visible again, it asks at once.

### The level and the count, from the mod through ntfy.sh

Your level and ntfy.sh's count live on your computer, in the mod. narsil-pet sends them in its silent status topic: your topic with `-estado` ("status") at the end, posted after each turn while you write from away ([Alerts on your phone and watch](/en/mods/pet/phone-and-watch/) describes the topic and its five fields). Its README says that topic is read by this extension "because they are data only the PC knows".

The block uses three of the five fields:

- **`xp`**, a label such as `⭐ Nivel 4 · 350/400 XP` ([Experience and growth](/en/mods/pet/experience-and-growth/) explains the levels). `lib/state.js` splits it into the name, the points into the level and the points it needs, for the bar.
- **`art`**, the address of Narsil's picture at her stage. It is accepted only when it points at narsil-pet's own assets.
- **`usage`**, one row named `ntfy` with its label, percent, color, note and reset time.

The fourth field, `at`, is when the mod sent it. Newer data always wins: a message older than the one already shown is ignored.

### Why the background script reads ntfy.sh, not the page

The content scripts run inside `claude.ai`, under the page's Content Security Policy. So `background.js` does the reading. The code's own description: from there, "claude.ai's Content-Security-Policy does not apply, and the topic and the key never reach the page."

The two sides talk over a port ([MDN: runtime.connect](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/connect)):

1. When a `claude.ai` page shows the block, its content script opens a port named `narsil-band`. The background accepts only ports from its own extension.
2. With the first port, the background starts reading; with the last one gone, it stops. A page that is hidden closes its port, so nothing is read while you are not looking.
3. Each time the status changes, the background posts the opened status to every port. It never posts the topic or the key.

### Polling first, then following the stream

ntfy.sh can send a topic as a JSON stream, "one JSON message object per line", and its `poll=1` option ends the connection once the cached messages are read ([ntfy: subscribe API](https://docs.ntfy.sh/subscribe/api/)). The background uses both, only on the `-estado` topic:

1. **Poll the last 12 hours**: `https://ntfy.sh/<topic>-estado/json?poll=1&since=12h`. This brings the most recent status at once.
2. **Follow the stream** from the id of the last message it got, so nothing is read twice and nothing is missed.

The stream is read with `fetch` and a stream reader, line by line, not with `EventSource`. The reason is in `lib/stream.js`: the Chromium package runs the background as a service worker, "which has no EventSource". When the stream ends, it starts again from the last message it brought; when it fails, it waits one second, then twice as long each time, up to a minute.

In Chromium, the service worker is stopped after 30 seconds without activity ([Chrome: the extension service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)), and the stream with it. So while the block is showing, the content script sends a word on its port every 25 seconds to keep it awake.

The last status is also saved in `storage.local`, with the topic it belongs to, so a page that opens later shows it at once. The code's comment explains why that is enough: "what it brought is kept, as ntfy.sh keeps it for 12 h".

### Sealed messages and the key

If you turned on `/narsil movil clave` on your computer, the mod seals what it posts: the status arrives as a text starting with `narsil1:`, unreadable without the key. `lib/seal.js` opens it with the key from the options, following the scheme narsil-pet's `hooks/seal.ts` uses ([the phone guide](/en/mods/pet/phone-and-watch/) describes it step by step):

1. Two keys are derived from yours: HMAC-SHA256 of `enc` and of `mac`.
2. The text after `narsil1:` is decoded from base64url into a 16-byte nonce, the ciphertext and a 32-byte tag.
3. The tag is computed again over the nonce and the ciphertext, and compared with the one received. If they differ, the message is not opened.
4. Only then is the text decrypted, 32 bytes at a time, with HMAC-SHA256 of the nonce and a block counter as the keystream.

The mod builds HMAC by hand because its hooks module has only SHA-256. The extension does not need to: the browser's WebCrypto has HMAC built in ([MDN: SubtleCrypto.sign](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/sign)), and narsil-pet's comment says WebCrypto's HMAC "gives the same bytes".

When a sealed message does not open, because there is no key or it is the wrong one, the block shows `🔒 Toca y pon la clave` ("tap and enter the key"), and a tap opens the options. A message that is not sealed is read as it is, with or without a key.

### What the topic's readers could do, and how the block defends itself

Without a key, anyone who knows your topic can also publish on it. So what arrives from ntfy.sh is never trusted as markup: every value goes into the block with `textContent`, and a picture is shown only when its address starts with narsil-pet's own assets folder. A fake status could show a wrong level or count, but it cannot add a link, a script or an image from elsewhere.

### "More than an hour old", and why the count comes from the PC

The mod sends a status only while you write from away. When you go back to the desk, the last status stays, and ages. So when a status is more than an hour old, the `ntfy hoy` row adds a note such as `dato de hace 3 h` ("data from 3 h ago"). The level gets no such note.

The count itself has to come from the computer, because ntfy.sh counts messages per IP address. The mod asks ntfy.sh, from the computer's network, how many messages that network has sent today, and puts the answer in its status. If the phone asked, ntfy.sh would answer about the phone's network, which sends nothing. As the phone guide explains, that day also starts at an hour of ntfy.sh's own, not at midnight, which is why the row shows its own reset time.

## How it was asked of the AI

No request for the block was recorded. The owner's words recorded for this path are about the site ([guide 1](/en/mods/claude/what-it-is/) quotes them). The following is reconstructed from the extension's commit history:

- `c200e8a` (2026-11-09) "feat: show Narsil's state in claude.ai's sidebar on Firefox for Android". The first version: "A row under the search, with a panel for the conversations, limits, cache and alerts", reading ntfy.sh "from the background page, live while the page shows it".
- `00adbb9` (2026-11-09) "feat: show only Narsil's level, the limits and ntfy's count in the sidebar". The limits moved to `claude.ai` itself: "ntfy.sh is only read for what the page cannot know: her level and its own count, so the extension no longer follows the alerts topic."
- `11dadb3` (2026-11-10) "feat: run the extension in Vivaldi for Android as a Chromium package". The stream moved from `EventSource` to `fetch`, with the growing wait after a failure and the word every 25 seconds.

On the mod's side, narsil-pet's `544ef89` (2026-11-09) "feat: send only what the Firefox extension reads through ntfy" cut its status down to the five fields above, the same day.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> In my extension for `https://claude.ai/*`, add a block right after the side menu's Search button, found by its position, not its text. The content script opens a `runtime.connect` port to the background while the page is visible and closes it when hidden. The background reads the topic from `storage.local`, polls `https://ntfy.sh/<topic>-estado/json?poll=1&since=12h`, then follows the same JSON stream with `fetch` and a stream reader from the last message id, retrying with a doubling wait up to 60 s. It posts the newest parsed status to every port, never the topic. In the block, show the `xp` field as text with `textContent`, accept an image URL only from one fixed prefix, and add "data from N h ago" when the status's `at` is over an hour old. Test the parsing and the stream with `node --test`, passing a fake `fetch`.

## The minimal code

The two halves, written for this guide (MIT). The background follows the status topic and sends what it reads to the block; the content script shows it. Try it with an invented topic such as `narsil-0123456789abcdef0123`, on a topic of your own.

`background.js`:

```js
const ports = new Set()
let controller = null
let latest = null

async function follow(topic, signal) {
  let since = null
  let wait = 1000
  while (!signal.aborted) {
    try {
      const query = since ? `?since=${encodeURIComponent(since)}` : '?since=12h'
      const response = await fetch(`https://ntfy.sh/${topic}-estado/json${query}`, { signal })
      if (!response.ok || !response.body) throw new Error(`ntfy.sh ${response.status}`)
      wait = 1000
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
      let rest = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        const lines = (rest + value).split('\n')
        rest = lines.pop()
        for (const line of lines.filter(Boolean)) {
          const message = JSON.parse(line)
          if (message.event !== 'message') continue
          since = message.id
          latest = JSON.parse(message.message)
          ports.forEach((port) => port.postMessage(latest))
        }
      }
    } catch {
      if (signal.aborted) return
      await new Promise((resolve) => setTimeout(resolve, wait))
      wait = Math.min(wait * 2, 60_000)
    }
  }
}

browser.runtime.onConnect.addListener(async (port) => {
  if (port.sender?.id !== browser.runtime.id) return
  ports.add(port)
  port.onDisconnect.addListener(() => {
    ports.delete(port)
    if (ports.size === 0) controller?.abort()
  })
  if (latest) port.postMessage(latest)
  if (ports.size > 1) return
  const { topic } = await browser.storage.local.get('topic')
  if (!/^[-_A-Za-z0-9]{1,64}$/.test(topic ?? '')) return
  controller = new AbortController()
  follow(topic, controller.signal)
})
```

In the content script:

```js
const level = document.createElement('div')
const port = browser.runtime.connect({ name: 'my-block' })
port.onMessage.addListener((status) => {
  const hours = Math.floor((Date.now() / 1000 - (status.at ?? 0)) / 3600)
  level.textContent =
    hours >= 1 ? `${status.xp} · data from ${hours} h ago` : String(status.xp ?? '')
})
```

`TextDecoderStream` and the stream reader are standard ([MDN: Using readable streams](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams)), and they work in a Chromium service worker, where `EventSource` does not. A message that is not valid JSON throws inside the loop and the stream restarts just after it, which is enough for an example; the extension skips such lines instead.

## Common mistakes and how to test it

- **Reading ntfy.sh from the page.** The content script would need the topic, and so would anything else running on the page. Keep the topic in the background.
- **Finding Search by its text.** The label changes with the page's language. Find it by its position.
- **`EventSource` in Chromium.** The service worker has none; use `fetch` and read the body.
- **A stream that never restarts.** ntfy.sh, the network or the phone will close it. Restart from the last message id, and wait longer after each failure.
- **A sleeping service worker.** Chromium stops an idle one after 30 seconds, and the stream stops with it. Keep it awake while the block is shown, and let it sleep when nothing is.
- **Trusting the topic.** Without a key, anyone with the name can publish. Show only text, and images from one fixed address.
- **Asking ntfy.sh for the count from the phone.** The answer is about the phone's network. The count has to come from the computer.
- **A count that never moves.** The mod sends its status only while you write through Remote Control. At the desk, the block keeps the last one and marks its age.

To test it, publish a made-up status to your own test topic from a computer: `curl -d '{"xp":"⭐ Nivel 2 · 40/200 XP","at":1700000000}' https://ntfy.sh/narsil-0123456789abcdef0123-estado` ([ntfy: publishing](https://docs.ntfy.sh/publish/)), with a topic you invented. The block should show the level within a second, and the age note, since that `at` is long past. Then turn off the network for a minute and back on: the stream should resume, and a status published while it was off should arrive.

## Going further

- [Guide 4](/en/mods/claude/colors-and-icon/) dresses the whole page in Narsil's colors, and gives the home screen app her icon.
- [Guide 5](/en/mods/claude/android-packaging/) explains the Chromium package, and why its background needs the 25-second word.
- The limits could warn you before you reach them, as Narsil does inside Claude Code: see [Context and limits](/en/mods/pet/context-and-limits/).
