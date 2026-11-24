---
title: Alerts on your phone and watch
description: 'How /narsil movil sends what needs you to a private ntfy.sh topic while you write from away, with a daily limit, a silent state topic, an optional key that seals the content, and Web Push.'
route: pet
order: 15
updated: 2026-11-24
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/phone.ts
  - repo: pet
    path: hooks/seal.ts
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: hooks/usage.ts
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## What it does

When you work away from the computer, driving Claude Code through Remote Control from your phone or the web, the band and the floating window are out of sight. `/narsil movil` ("mobile") sends what needs you to your phone instead: a conversation finished, needs you, or failed. A watch that mirrors the phone's notifications shows them too; Narsil's README names Wear OS. Beside the alerts, Narsil also publishes a silent state (her level, Claude's limits, the open conversations) that [Narsil Watch](https://github.com/davshn/narsil-watch), a Wear OS app, draws on your wrist.

The alerts travel through [ntfy.sh](https://ntfy.sh), a public notification service. The command creates a topic with a random name, such as `narsil-0000000000example0` (every topic name in this guide is a made-up example). To receive them, you write that topic in the settings of [Narsil for Android](https://github.com/davshn/narsil-android) ([what it is](/en/android/what-it-is/), [its alerts service](/en/android/alerts-service/)), or you subscribe to it in the ntfy app. Either way, the alerts arrive as notifications with Narsil's picture at her stage, in the pose of the alert, and a button that opens the Claude app.

Narsil only sends while your last message, in any conversation, came from Remote Control. The moment you write at the desk again, in any of them, she stops. So the phone hears from her only when you are actually away.

> **Warning: anyone who knows the topic's name can read it, and can publish to it.** ntfy.sh topics, as Narsil uses them, have no password: the name is the only thing that keeps them private. Do not share it, do not paste it in screenshots, and run `/narsil movil nuevo` to move to a new one if it leaks. Use the key (`/narsil movil clave`) if your receivers support it (Narsil for Android and Narsil Watch do; the ntfy app does not): with it, the title and the text of each alert become "Narsil" and unreadable text for anyone without the key, although the kind of alert, its time and Narsil's stage still show.

The commands:

| Command                   | What it does                                                                   |
| ------------------------- | ------------------------------------------------------------------------------ |
| `/narsil movil` or `on`   | Turns alerts on (creating the topic the first time) and says how to follow it. |
| `/narsil movil off`       | Turns them off; `on` turns them back on with the same topic.                   |
| `/narsil movil nuevo`     | Creates a new topic; the old one receives nothing more.                        |
| `/narsil movil prueba`    | Sends a test alert, even from the desk.                                        |
| `/narsil movil clave`     | Creates a key and seals everything sent from now on.                           |
| `/narsil movil clave off` | Stops sealing.                                                                 |

## How it works inside

`hooks/phone.ts` holds the plain parts (the topic, the message, the count) as pure functions; `hooks/seal.ts` holds the sealing; `hooks/register.tsx` sends and counts.

### The topic: `narsil-` and 20 hex characters

`newTopic(crypto.randomUUID())` in `hooks/phone.ts` takes a random UUID, keeps only its hexadecimal characters, lowercases them and keeps the first 20: `narsil-` followed by 20 characters from `0-9a-f`. The comment above it states the whole security model of the topic: "A topic nobody guesses: whoever knows its name can read it."

The topic is saved in the preferences (`phoneTopic` in `prefs`, stored with `$.store`), so every conversation uses the same one. `/narsil movil nuevo` replaces it with a fresh one.

Two more topics hang from it, by name:

- `<topic>-estado` ("state"): a silent state that Narsil for Android and Narsil Watch read (below).
- `<topic>-push`: where a phone web app leaves its Web Push subscription (below).

### When an alert is sent: where you last wrote

The rule comes from the author's request in the task log (quoted below): alert the phone when you asked from the phone. No event tells a mod that Remote Control is on, so Narsil looks at where your messages come from.

The 2.1.325 types give `prompt.submit` and `command.run` an `origin`, a `PromptOrigin`. Two of its kinds matter here: `composer`, "The user's own gesture at the terminal", and `bridge`, "The user's message through the Remote Control bridge (a phone or web client)". `noteOrigin` in `hooks/register.tsx`, called from both hooks, records the last one:

- `bridge` means away; `composer` means at the desk; any other kind changes nothing.
- It is written to `$.store` under `remoteOrigin`, not only to a module variable. The store is shared by every conversation of the plugin, so a conversation you started at the desk also alerts while you write from the phone in another one, and none does once you write at the desk anywhere.

`isAway` reads it back, falling back to the module variable when the store fails.

### What an alert carries

Every alert goes through `announce` (guide 6), which ends by calling `sendToPhone`. `phoneMessage` in `hooks/phone.ts` builds the JSON that ntfy.sh takes:

- `topic`: your topic.
- `title`: "Narsil · He terminado · api", with the conversation's name last.
- `message`: the text, then, when more than one conversation is open, a list such as "Conversaciones:" followed by "● web · ERROR" and "● api · TRABAJANDO". The phone's text for a finished turn is longer than the desktop's, since a phone has room for more of Claude's answer.
- `priority`: 3 for a finish, 4 for a question or an error.
- `tags`: `white_check_mark`, `raising_hand` or `warning`, which the ntfy app shows as an emoji.
- `icon`: her picture as a PNG at her stage and in the alert's pose, from the repository on GitHub, which the phone downloads itself.
- `actions`: one "Abrir Claude" button to `https://claude.ai/code`. The comment explains that nothing on a phone links to the conversation itself, so the button opens the Claude app, where Remote Control lists it.

`postToPhone` sends it with `$.http.fetch` as a `POST` to `https://ntfy.sh` with a JSON body. Quiet mode applies as everywhere: a finish is not sent, a question or an error is.

### The daily limit: 200

`PHONE_DAILY` is 200. The code's comment: "ntfy.sh takes 250 a day for free: Narsil stops short of it." The README says the same.

The count lives in `$.store` under `phone`, as `{ day, sent }`, shared by every conversation. `day` comes from `dayOf`, the UTC date ("2026-10-31"), so the count starts over at midnight UTC, not at local midnight. A stored count from another day, or an odd value, counts as zero.

Before each message, `postToPhone` checks the count and stops at 200. The 200th message, when it is an alert, ends with "(último aviso de hoy: mañana sigo)" ("last alert today: I will go on tomorrow"). A message that fails to send is not counted. The messages on the `-estado` topic count against the same 200.

### The `-estado` topic and its fields

After every turn of the main conversation, and with each question, `sendStatus` posts a small state to `<topic>-estado`, under the same rules as the alerts (alerts on, you away, the daily count). `/narsil movil prueba` sends one too, after its test alert. It goes with `priority: 1` and no title, and the code's comment says this topic is "not followed by push, so its messages never show as notifications".

Two apps read it, "because this is data only the PC knows", as the README puts it. Narsil for Android takes Narsil's level, her picture and the ntfy.sh count for its band and its side menu ([the conversation band](/en/android/conversation-band/)); the README says the state, context and limits of the open conversation come from Claude's own page there. Narsil Watch reads Claude's limits and the open conversations from it ([reading the state](/en/watch/reading-the-state/)); its README says it reads the latest message every 15 minutes, and whenever you open the app or the tile. Some comments in `hooks/phone.ts` and `hooks/register.tsx` still name an earlier browser extension as the reader; that is history, not what reads the topic today.

The message is a JSON text with these fields:

| Field          | What it is                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------- |
| `xp`           | Narsil's level label, "⭐ Nivel 3 · 120/300 XP" (guide 13).                                       |
| `art`          | The URL of her picture, at her stage, in the pose of the most important open conversation.        |
| `at`           | When it was sent, in Unix seconds.                                                                |
| `cacheMinutes` | How long the prompt cache lasts, from the first open conversation that has one; absent otherwise. |
| `limits`       | Claude's 5-hour and weekly limits, up to two rows, or empty when none is known (below).           |
| `sessions`     | Up to 8 open conversations, most important first, each `{ title, status, label }` (below).        |
| `usage`        | One row, `ntfy`, with ntfy.sh's own count of today's messages from your network, or empty.        |

`limits` and `sessions` arrived in version 3.10.0, for the watch; the comment above them says "what the watch shows: Claude's limits and every open conversation".

`limits` is built by `watchLimits` in `hooks/phone.ts` from what this conversation knows of the account's limits. That comes from the status line: `usageOf` in `hooks/usage.ts` takes the `five_hour` and `seven_day` windows. Each row is `{ key, label, percent, color, resetsAt }`: `key` is `fiveHour` or `week`, `label` is "5 horas" (5 hours) or "Semana" (week), `color` comes from `levelColor` (green `#22B573` below 60%, amber `#F5B400` from 60%, red `#F0435A` from 85%), and `resetsAt` is the reset time in Unix seconds, or `null` "when Claude did not say". A window Claude has not reported leaves no row. The context window is not sent: the comment says "the context is each conversation's own".

`sessions` is built by `watchSessions` from the same list of open conversations the band and the alerts use, most important first. It keeps the first `WATCH_SESSIONS`, 8, and cuts each title to 40 characters, the last one an ellipsis (`…`); a conversation without a title is called "conversación" (conversation). `status` is the state's code (`working`, `idle`, `waiting`, `done`, `error`) and `label` its on-screen name from `STATUS_LABEL` in `hooks/words.ts`: `TRABAJANDO` (working), `PARADA` (stopped), `TE NECESITA` (needs you), `TERMINADA` (done) or `ERROR`. Both cuts are about size. The comment: "as few and as short as an ntfy message (4 KB, more once sealed) holds with room to spare".

For `usage`, Narsil asks `GET https://ntfy.sh/v1/account` and builds the row with `ntfyRow`: `{ key: 'ntfy', label: 'ntfy hoy', percent, color, note, resetsAt }`, counting the message about to go. The comment explains why this count differs from Narsil's own: ntfy.sh counts by IP address, "in a day of its own that starts at an hour hashed from the IP, not at midnight".

### The optional key, and how the content is sealed

`/narsil movil clave` ("key") creates a key with `newKey()`: 32 random bytes from `crypto.getRandomValues`, written in base64url (43 characters). It is saved in the preferences (`phoneKey`) and shown in the command's answer, so you can paste it into the receivers' settings: Narsil for Android's, and Narsil Watch's if you use it. From then on, everything Narsil posts to ntfy.sh, alerts and `-estado` alike, is sealed.

What is sealed and what is not, from `sealedMessage` and `sealedPayload` in `hooks/phone.ts`:

- **Sealed:** the title and the text, together as JSON inside `message`.
- **In the clear:** the topic, `title` replaced by just "Narsil", the priority, the tags, the icon URL and the button.

So a sealed alert still shows that an alert happened, when, its kind (through the priority, the tag and the pose in the icon's file name) and Narsil's stage (through the icon's folder). The conversation's name, Claude's answer and the list of conversations are inside.

The scheme, exactly as `hooks/seal.ts` implements it. The file's comment explains why it is built by hand: "The hooks module's crypto has SHA-256 alone". The 2.1.325 types agree: the hooks module's `crypto.subtle` declares `digest` and nothing else. So:

1. **HMAC-SHA256 from `digest`.** `hmac(key, data)` is the textbook construction over SHA-256: the key padded to 64 bytes (hashed first if longer), then `SHA-256((key ⊕ 0x5c) ‖ SHA-256((key ⊕ 0x36) ‖ data))`.
2. **Two keys from one.** From the 32-byte key, `encKey = HMAC(key, "enc")` and `macKey = HMAC(key, "mac")`.
3. **A fresh nonce.** 16 random bytes for each message.
4. **The keystream.** Block `i` is `HMAC(encKey, nonce ‖ i)`, with `i` as 4 bytes, big-endian; each block gives 32 bytes, XORed with the UTF-8 text. The comment calls this counter mode (CTR).
5. **The tag.** `HMAC(macKey, nonce ‖ ciphertext)`, 32 bytes, over the encrypted bytes (the comment calls it "encrypt-then-MAC").
6. **The text sent.** `narsil1:` followed by the base64url of `nonce ‖ ciphertext ‖ tag`.

`unseal` reverses it: it checks the `narsil1:` prefix and a minimum length, recomputes the tag and compares it byte by byte, and only then decrypts. A wrong key, a changed byte or an unsealed text gives `null`. The test "what the mod seals, it opens; with another key, or tampered, it does not" checks those three cases. The comment says the receivers open it with WebCrypto's HMAC, "which gives the same bytes". Today's receivers live in their own repositories and are Kotlin apps: Narsil for Android and Narsil Watch each have a `Seal` object that repeats these steps with Java's `HmacSHA256` (`javax.crypto.Mac`).

This guide describes what the code does and makes no claim beyond it. If you adapt it, review it as you would any hand-built cryptography.

The ntfy app cannot open sealed messages: it shows the noise. Narsil says so when you turn the key on, and `/narsil movil clave off` goes back to plain text. Running `/narsil movil clave` again makes a new key, which is how you rotate it; the old one stops opening new messages, so put the new one in each app again.

### Web Push: keeping a phone web app subscribed

Besides the ntfy app and Narsil for Android, alerts can reach a web app of your own through Web Push; the README speaks of "your own web app". ntfy.sh can deliver a topic by Web Push to a browser subscription, but, as the code's comment puts it, "ntfy.sh drops a subscription whose delivery failed once". The app could re-register when you open it, but then the alerts would wait for you to open it.

So the mod registers it again before each alert (`renewPush`, called only for alerts, not for `-estado`):

1. The app leaves its subscription, `{ endpoint, auth, p256dh }`, on `<topic>-push`, sealed with the key when there is one.
2. `latestPush` reads the last message there, `GET https://ntfy.sh/<topic>-push/json?poll=1&since=latest`. With a key, it opens it with `unseal`; without, it reads it as is.
3. `pushSubscriptionOf` accepts only an `https` endpoint of at most 1,000 characters and two short base64url keys; anything else is ignored.
4. A valid one is kept in `$.store` under `phonePush`. When ntfy.sh has forgotten the message (the comment says it keeps a message 12 hours), the kept one is used.
5. It is posted to `https://ntfy.sh/v1/webpush` with `topics: [your topic]`.

Registering publishes nothing, so it does not count against the 200. Any failure is swallowed, and the alert goes as it would have.

Two privacy notes follow from the code. The subscription itself goes to ntfy.sh in the clear, as Web Push needs. And without a key, anyone who knows the topic can leave a subscription on `<topic>-push`, and the mod will register it for your topic; with a key, the mod takes only a subscription that opens with it.

### The privacy model in plain words

- **ntfy.sh sees everything that is not sealed**, and the time and network of every message. It is a third-party service: read its terms before you send anything there.
- **The topic name is the password.** Whoever has it can read every message and publish fake ones. A random name makes it hard to guess, not secret once shared.
- **Without a key**, a reader of the topic sees the conversation names, the text of each alert (part of Claude's answer) and the list of open conversations; a reader of `-estado` also sees Narsil's level and Claude's 5-hour and weekly limits.
- **With a key**, a reader sees that an alert happened, its kind, its time and Narsil's stage, but not the text. A forged message does not open with the key, which a receiver that checks the tag can reject.
- **The key lives in two places on the PC**: in the plugin's store, a JSON file under the Claude Code configuration directory, and in the answer of `/narsil movil clave`, which is part of the conversation. It also lives in each app you paste it into. Narsil's command answers do not set `isTextDisplayOnly`, and the 2.1.325 types say that, apart from plugins bundled with Claude Code, "Any other plugin's text stays in requests", so the model reads it too. Treat the conversation as holding the key.
- **Sending stops at the desk.** Nothing goes while your last message came from the terminal or the desktop app, except the test.

## Build it with Claude

Ask Claude to send what needs you to your phone through ntfy.sh, only while you are away. The one idea it must get right is that being away is not an event: it is read from where your last message came from, `bridge` for Remote Control and `composer` for the desk.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> In my Claude Code mod `my-pet`, add phone alerts through ntfy.sh. `/my-pet phone` creates a topic `my-pet-` plus 20 hex characters from `crypto.randomUUID()`, saves it in `$.store`, and answers how to subscribe in the ntfy app, warning that anyone who knows the topic can read it. Record where the person last wrote: in `prompt.submit` and `command.run`, `e.origin.kind === 'bridge'` means away and `'composer'` means at the desk; keep it in `$.store` so every conversation shares it. When a main-conversation turn ends, and only while away, post `{ topic, title, message, priority }` as JSON to `https://ntfy.sh` with `$.http.fetch`. Count the messages per UTC day in `$.store` and stop at 200. Never put the topic in logs. Test with `claude-code/testing`, answering `http.fetch` yourself: nothing is sent at the desk, an alert is sent from the bridge, and the 201st of the day is not.

### What to check in Claude's answer

1. The topic is `my-pet-` followed by 20 hex characters from `crypto.randomUUID()`, never a name someone could guess, and it never appears in a log.
2. Both `prompt.submit` and `command.run` record the origin, and it is kept in `$.store`, so every conversation shares it.
3. Nothing is posted while the last message came from the desk.
4. The messages are counted per UTC day in `$.store`, the count is checked before each message, and sending stops at 200.
5. The command's answer warns that anyone who knows the topic can read it.

If a check fails, tell Claude what you see: "my phone buzzes while I am typing at the desk".

### How the author asked for it

#### Recorded: alert the phone when I write from the phone

The phone rule as it works today was asked for in the fleet view's task log, `odd/tasks/fleet-view.md`. L1 (2026-11-06), the original request, includes:

> "las notificaciones se enviarian al celular cuando se pida algo desde el celular como ahora y haya cambios, es decir alguna tarea pase de trabajando a terminado, o de trabajando a error, etc, [...] las notificaciones del celular cuando se envien llevarian la info de todas las sesiones funcionando en ese momento"

In English: the notifications would be sent to the phone when something is asked from the phone, as now, and there are changes, that is, some task goes from working to done, or from working to error, and so on; the phone's notifications, when sent, would carry the information of every session running at that moment.

In L2, answering whether a conversation started at the desk should alert too while the author writes from the phone in another:

> "si claro me avisas al movil"

In English: yes, of course, you alert me on the phone.

The task log records the result in L9 (T4 done): "Where you last wrote (phone or desk), in any conversation, is kept in the store (`remoteOrigin`), so every conversation alerts the phone on its changes (done, waiting, error) while your last message came from the phone, and none does once you write at the desk anywhere. Each alert ends with "Conversaciones:" and one line per open conversation". That is what `noteOrigin`, `isAway` and `fleetText` do today.

L9 also describes a richer `-estado` state, with a `sessions` list (tag, title, status, label, headline, context %, isThis) and the most important conversation's fields. That state was later cut down: `544ef89` (2026-11-09) "feat: send only what the Firefox extension reads through ntfy" left five fields. The subject names the reader of that time, a browser extension; today Narsil for Android and Narsil Watch read the topic. A shorter `sessions` list, only `title`, `status` and `label`, came back in `6400a6f` (2026-11-23), together with `limits`, for the watch.

#### Reconstruction from the commit history

The earlier steps were not recorded. From `git log -- hooks/phone.ts hooks/seal.ts` and the related commits:

- `d91997f` (2026-10-31) "feat: send what needs you to your phone and watch through ntfy, with Narsil's picture". The topic, the alerts, the icon and the limit of 200 arrive together.
- `c27a9e4` (2026-10-31) "feat: send phone alerts only while you write through Remote Control". The rule of where you last wrote.
- `4f8abaa` (2026-11-01) "feat: send the state the band shows to a status topic for your own phone app". The `-estado` topic.
- `5a9ee10` (2026-11-01) "feat: seal phone messages with /narsil movil clave, send reset times and an Abrir Claude button". `hooks/seal.ts` is born.
- `644e59f` (2026-11-01) "fix: send the state to the phone with each question, so the app shows Narsil waiting".
- `7498be5` (2026-11-02) "feat: register the phone app's push subscription again before each alert, so alerts keep coming after ntfy.sh drops it".
- `3a1f31c` (2026-11-06) "feat: alert the phone for every conversation and list them all". The request quoted above.
- `544ef89` (2026-11-09) "feat: send only what the Firefox extension reads through ntfy". Its message: "The phone web app is gone", and the Web Push renewal went with it. The extension it names was the state's reader then; it has since been replaced by Narsil for Android.
- `5fe48c9` (2026-11-10) "feat: register the phone app's push subscription again before each alert". Its message: "The phone web app is back as the alert receiver, in Chrome", and the renewal returned, now with the 12-hour fallback.
- `6400a6f` (2026-11-23) "feat(phone): publish Claude limits and open conversations for the watch". Its message: "The status topic now carries the 5-hour and weekly limits (percent, color, reset) and up to 8 open conversations, so a Wear OS app can show them." `watchLimits` and `watchSessions` arrive.
- `9437318` (2026-11-23) "chore(release): 3.10.0". The version that ships `limits` and `sessions`.
- `c4312cd` (2026-11-24) "docs(readme): point the phone alerts to Narsil for Android and explain how it works". Its message says the app replaces the earlier browser extension and the web app: "it reads <topic>-estado for its band and opens the encrypted alerts with the key". The code did not change in this commit, only the README.

The history shows a feature shaped by its receivers: each time the app on the other side changed, the mod's side changed with it.

## Reference code

This is one correct answer, written for this guide. Read it to understand how the pieces fit together and to compare it with what Claude wrote for you: Claude may choose other names or another order and still be right.

Written for this guide and checked against the 2.1.325 types (`$.store.get`, `$.store.set`, `$.http.fetch`, `$.clock.now`, `$.command.register`, `command.run`, `prompt.submit`, `turn.complete`, `crypto.randomUUID`). It is adapted from `hooks/phone.ts` and `hooks/register.tsx` in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). It sends plain text; for sealing, read `hooks/seal.ts`.

```tsx
import type { EngineInterface, Register } from 'claude-code'

const NTFY = 'https://ntfy.sh'
const DAILY = 200

async function isAway($: EngineInterface): Promise<boolean> {
  return (await $.store.get('away').catch(() => false)) === true
}

async function noteOrigin($: EngineInterface, kind: string): Promise<void> {
  if (kind === 'bridge' || kind === 'composer')
    await $.store.set('away', kind === 'bridge').catch(() => undefined)
}

async function sendToPhone($: EngineInterface, title: string, message: string): Promise<void> {
  const topic = await $.store.get('topic').catch(() => undefined)
  if (typeof topic !== 'string' || !(await isAway($))) return
  const day = new Date(await $.clock.now()).toISOString().slice(0, 10)
  const saved = (await $.store.get('sent').catch(() => undefined)) as
    { day?: string; sent?: number } | undefined
  const sent = saved?.day === day && typeof saved.sent === 'number' ? saved.sent : 0
  if (sent >= DAILY) return
  try {
    const { ok } = await $.http.fetch(NTFY, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ topic, title, message, priority: 3 }),
    })
    if (ok) await $.store.set('sent', { day, sent: sent + 1 })
  } catch {
    // offline: the alert is lost, and nothing else breaks
  }
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'my-pet', description: 'My pet: phone' })
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    await noteOrigin($, e.origin.kind)
    return next(e)
  })

  on('command.run', { command: 'my-pet' }, async ($, e) => {
    await noteOrigin($, e.origin.kind)
    if (e.args.trim() !== 'phone') return { text: 'Usage: /my-pet phone' }
    let topic = await $.store.get('topic').catch(() => undefined)
    if (typeof topic !== 'string') {
      topic = `my-pet-${crypto
        .randomUUID()
        .replace(/[^0-9a-f]/gi, '')
        .toLowerCase()
        .slice(0, 20)}`
      await $.store.set('topic', topic)
    }
    return {
      text: `Subscribe to ${topic} on ntfy.sh in the ntfy app. Anyone who knows this name can read it: do not share it.`,
    }
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined && e.reason === 'answer')
      await sendToPhone($, 'My pet · Done', e.answer.slice(0, 300))
    return result
  })
}
```

The command's answer shows the topic once, on purpose, so the person can subscribe; remember that this answer stays in the conversation. Narsil does the same.

The two fields 3.10.0 added to the state are plain shaping, with no mod API. This version is written for this guide and adapted from `watchLimits` and `watchSessions` in `hooks/phone.ts` in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later):

```ts
type Meter = { percent: number; resetsAt?: string }
type Row = { title: string; status: string; label: string }

const colorOf = (percent: number): string =>
  percent >= 85 ? '#F0435A' : percent >= 60 ? '#F5B400' : '#22B573'

function limitsOf(u: { fiveHour: Meter | null; week: Meter | null }) {
  const row = (key: 'fiveHour' | 'week', label: string, m: Meter | null) => {
    if (!m) return []
    const at = m.resetsAt ? Date.parse(m.resetsAt) : NaN
    const resetsAt = Number.isNaN(at) ? null : Math.floor(at / 1000)
    return [{ key, label, percent: m.percent, color: colorOf(m.percent), resetsAt }]
  }
  return [...row('fiveHour', '5 horas', u.fiveHour), ...row('week', 'Semana', u.week)]
}

function sessionsOf(list: readonly Row[]): Row[] {
  return list.slice(0, 8).map((s) => {
    const title = s.title || 'conversación'
    const short = title.length > 40 ? `${title.slice(0, 39)}…` : title
    return { title: short, status: s.status, label: s.label }
  })
}
```

Narsil puts both beside the other fields of the state, `limits: watchLimits(...)` and `sessions: watchSessions(...)`, before the state is sealed (when there is a key) and posted to `-estado`.

## Common mistakes and how to test it

- **A guessable topic.** A topic named after you or your project can be read by anyone who tries it. Use a random name.
- **Logging the topic or the key.** Both are secrets. Keep them out of `$.ui.log`, screenshots, issues and test fixtures you publish.
- **Alerting at the desk.** Without the origin rule, the phone buzzes while you sit in front of the screen. Remote Control is not an event; the origin of the last message is the signal.
- **Keeping the origin in a module variable only.** Each conversation would then decide alone, and a conversation started at the desk would never alert while you write from the phone in another.
- **No daily cap.** A loop of failing turns can exhaust a free plan in minutes. Count before sending, per day, across conversations.
- **Believing "encrypted" means "invisible".** Narsil's sealing hides the title and the text, not the fact, time, kind and icon of an alert.
- **A state that outgrows its message.** The comment in `hooks/phone.ts` counts on 4 KB for an ntfy message. Cap the list and the titles before you send, as `watchSessions` does with 8 conversations and 40 characters.
- **Hand-built cryptography without tests.** Seal, open, wrong key and a flipped byte are the minimum, as Narsil's test does.

To test, `tests/narsil.test.tsx` answers `http.fetch` itself, so nothing reaches ntfy.sh. Worth reading: "the phone gets nothing until /narsil movil is turned on", "/narsil movil makes a private topic, says how to follow it, and sends what needs you there", "the phone gets alerts only while you write through Remote Control, never at the desk", "while you write from the phone in another conversation this one alerts too, and a message at the desk anywhere stops it", "the phone gets at most 200 a day, says which is the last, and starts again the next day", "/narsil movil clave seals what goes to ntfy.sh; clave off sends it in the clear again", "as a turn ends from the phone, the extension gets only what it reads on the status topic, silently", "the state the extension reads does not register the subscription; only alerts do", "an alert lists every open conversation, and the state wears the most important" and "the watch gets the 5-hour and weekly limits with their color and reset, and at most 8 conversations". Two of those names still say "the extension", from the time a browser extension read the state; the first of the two now checks that the state has exactly seven keys, `limits` and `sessions` among them.

### Where the code and the README differ

- The README says the key is one "that only your PC and your phone have: put it in Narsil for Android's settings". The answer of `/narsil movil clave` in `hooks/register.tsx` still tells you to put it in the options of the earlier browser extension, and the comment in `hooks/seal.ts` still lists that extension among the key's holders. Follow the README: the key goes in Narsil for Android, and in Narsil Watch if you use it.
- The README says to get the alerts by writing the topic in Narsil for Android or by subscribing in the ntfy app. The answer of `/narsil movil` (`phoneHelp`) explains only the ntfy app.
- The README's table of the `-estado` fields lists five: `xp`, `art`, `at`, `cacheMinutes` and `usage`. The code sends seven, with `limits` and `sessions`; the README mentions them only in its list of files, where `hooks/phone.ts` holds "the state the Narsil Watch reads (Claude's limits and the open conversations)".
- The README says the `-estado` state goes "At the end of each turn". The code also sends it with each question, and with the test.

## Going further

- `fleetText` in `hooks/phone.ts` builds the list of conversations under each alert.
- The other side of the topics: how Narsil for Android keeps the alerts coming ([its alerts service](/en/android/alerts-service/)) and draws the state in [its band](/en/android/conversation-band/), and how Narsil Watch [reads the state](/en/watch/reading-the-state/) ([what it is](/en/watch/what-it-is/)).
- `ntfyRow` turns ntfy.sh's account answer into the same kind of usage row the band draws for the account limits (guide 7).
- `summary` in `hooks/words.ts` cuts Claude's answer for the alert, with more room for the phone (`PHONE_ROOM`).
- The next guide, the session summary, is another thing Narsil counts and keeps in `$.store`.
