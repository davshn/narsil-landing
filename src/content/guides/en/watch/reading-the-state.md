---
title: Reading Narsil's state
description: 'What the mod now publishes on <topic>-estado, limits and conversations included, and how the watch fetches the latest message from ntfy.sh, opens its seal with your key and keeps it.'
route: watch
order: 2
updated: 2026-11-24
sources:
  - repo: pet
    path: hooks/phone.ts
  - repo: pet
    path: hooks/seal.ts
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/domain/NarsilState.kt
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/data/StatusParser.kt
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/data/StatusRepository.kt
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/data/Seal.kt
  - repo: watch
    path: app/src/test/kotlin/tech/davshn/narsilwatch/data/SealTest.kt
---

## What it does

Everything the watch shows comes from one small JSON message. The Narsil mod writes it on your computer and posts it to ntfy.sh, on the topic `<your topic>-estado`. The watch reads the latest one, opens it if it is sealed, and keeps it so the tile, the complication and the app can draw from it at any time.

This guide follows that message from one end to the other: what the mod puts in it since narsil-pet 3.10.0, the Kotlin classes it is read into (`NarsilState.kt`), the request and what is kept (`StatusRepository.kt`), the parsing (`StatusParser.kt`), and the seal (`Seal.kt`), including what happens with a wrong key or an unsealed message.

> **Experimental.** The watch can only read what the mod last published, and the mod publishes only while you are away from the computer, within ntfy.sh's free daily room. ntfy.sh keeps a message for a limited time, so a long quiet spell leaves the watch with its own last copy. And the state's shape is a private agreement between two projects: a change in the mod can break the reading.

The examples use made-up values only: the topic `narsil-0000000000example0` and fake keys.

## How it works inside

### The mod's side: what `-estado` carries now

`sendStatus` in narsil-pet's `hooks/register.tsx` builds the state and `phoneStatus` in `hooks/phone.ts` wraps it for ntfy.sh: `{ topic: "<topic>-estado", message: JSON.stringify(state), priority: 1 }`. The state itself is a JSON object with seven fields since commit `6400a6f`, "feat(phone): publish Claude limits and open conversations for the watch", released as 3.10.0:

| Field          | What it is                                                                                 | The watch uses it?  |
| -------------- | ------------------------------------------------------------------------------------------ | ------------------- |
| `xp`           | Narsil's level label, such as `⭐ Nivel 3 · 120/300 XP` (level 3).                         | Yes, in the app.    |
| `art`          | The URL of her drawing, at her stage, in the pose of the most important open conversation. | Yes, tile and app.  |
| `at`           | When it was sent, in Unix seconds.                                                         | Yes, the age label. |
| `cacheMinutes` | How long the prompt cache lasts; absent when no conversation has one.                      | Read, not shown.    |
| `usage`        | One row, `ntfy`, with ntfy.sh's count of today's messages from your network.               | No, ignored.        |
| `limits`       | Claude's 5-hour and weekly limits: percent, color and reset.                               | Yes, everywhere.    |
| `sessions`     | Up to 8 open conversations, most important first: title, status and label.                 | Yes, tile and app.  |

The two new fields are built by two pure functions at the end of `hooks/phone.ts`. These excerpts are from narsil-pet (GPL v3); this site's formatter has rewrapped their long lines and added trailing commas and parentheses, and nothing else differs from the file:

```ts
// One Claude limit as the watch draws it: its arc, its color and when it
// resets, in seconds since the epoch (null when Claude did not say).
export type WatchLimit = {
  key: 'fiveHour' | 'week'
  label: string
  percent: number
  color: string
  resetsAt: number | null
}

type Meter = { percent: number; resetsAt?: string }

// The 5-hour and weekly limits; the context is each conversation's own.
export function watchLimits(u: { fiveHour: Meter | null; week: Meter | null }): WatchLimit[] {
  const row = (key: WatchLimit['key'], label: string, m: Meter | null): WatchLimit[] => {
    if (!m) return []
    const at = m.resetsAt ? Date.parse(m.resetsAt) : NaN
    return [
      {
        key,
        label,
        percent: m.percent,
        color: levelColor(m.percent),
        resetsAt: Number.isNaN(at) ? null : Math.floor(at / 1000),
      },
    ]
  }
  return [...row('fiveHour', '5 horas', u.fiveHour), ...row('week', 'Semana', u.week)]
}
```

And right below it, the conversations:

```ts
export type WatchSession = { title: string; status: string; label: string }

// The open conversations, most important first, as few and as short as an
// ntfy message (4 KB, more once sealed) holds with room to spare.
export const WATCH_SESSIONS = 8
const WATCH_TITLE = 40

export function watchSessions(list: readonly WatchSession[]): WatchSession[] {
  return list.slice(0, WATCH_SESSIONS).map((s) => {
    const title = s.title || 'conversación'
    return {
      title: title.length > WATCH_TITLE ? `${title.slice(0, WATCH_TITLE - 1)}…` : title,
      status: s.status,
      label: s.label,
    }
  })
}
```

What to notice:

- **`limits` has zero, one or two rows**, `fiveHour` labeled `5 horas` (5 hours) and `week` labeled `Semana` (week). A limit Claude Code has not reported is left out, not sent as zero, and `resetsAt` is in seconds, or `null` when Claude did not say. The values come from the mod's `usage`, which `usageOf` in `hooks/usage.ts` fills from the session's rate limits of kind `five_hour` and `seven_day`, the same ones Claude Code's status line reads.
- **The color is decided on the computer.** `levelColor` in `hooks/usage.ts` returns `#F0435A` (red) from 85 %, `#F5B400` (yellow) from 60 %, and `#22B573` (green) below. The watch paints what it is told, so the computer and the watch never disagree.
- **`sessions` is the mod's ranked list.** `fleetOf` in `hooks/fleet.ts` sorts by `RANK`, "An error first, then what needs you, what works, what finished": `error`, `waiting`, `working`, `done`, `idle`. Among equals, the one that changed most recently comes first.
- **At most 8 sessions, titles of at most 40 characters.** The comment gives the reason: an ntfy message is limited to 4 KB, and sealing makes it longer. An empty title becomes `conversación`.
- **`status` is the machine word and `label` the screen word**, from `STATUS_LABEL` in `hooks/words.ts`: `working` is `TRABAJANDO`, `idle` is `PARADA`, `waiting` is `TE NECESITA`, `done` is `TERMINADA`, `error` is `ERROR`. The watch colors by `status` and writes `label`.

A state as the watch receives it, written for this guide with made-up values:

```json
{
  "xp": "⭐ Nivel 3 · 40/300 XP",
  "art": "https://raw.githubusercontent.com/davshn/narsil-pet/main/assets/etapa3/error-oscuro.png",
  "at": 1763900000,
  "cacheMinutes": 5,
  "usage": [],
  "limits": [
    {
      "key": "fiveHour",
      "label": "5 horas",
      "percent": 62.4,
      "color": "#F5B400",
      "resetsAt": 1763918000
    },
    { "key": "week", "label": "Semana", "percent": 90, "color": "#F0435A", "resetsAt": null }
  ],
  "sessions": [
    { "title": "web", "status": "error", "label": "ERROR" },
    { "title": "landing", "status": "waiting", "label": "TE NECESITA" }
  ]
}
```

It is the same shape `StatusParserTest.kt` uses.

### NarsilState.kt: the contract on the watch

The watch declares the same shape in Kotlin. The whole file, from `domain/NarsilState.kt` in narsil-watch (GPL v3), without its package and import lines:

```kotlin
// What Narsil publishes on its ntfy status topic, as hooks/register.tsx
// (sendStatus) builds it. Fields the PC adds later are ignored; fields it
// does not send yet default to empty.
@Serializable
data class NarsilState(
    val xp: String? = null,
    val art: String? = null,
    // seconds since the epoch
    val at: Long = 0,
    val cacheMinutes: Int? = null,
    val limits: List<Limit> = emptyList(),
    val sessions: List<Session> = emptyList(),
)

// One Claude limit: the 5-hour window or the week.
@Serializable
data class Limit(
    val key: String,
    val label: String,
    val percent: Double,
    val color: String,
    // seconds since the epoch, null when Claude did not say
    val resetsAt: Long? = null,
)

// One open conversation, most important first.
@Serializable
data class Session(
    val title: String,
    val status: String,
    val label: String,
)
```

The first comment is the design rule, and it works in both directions:

- **Fields the computer adds later are ignored.** The parser is built with `Json { ignoreUnknownKeys = true }`. That is why `usage` causes no error: it is not declared, so it is skipped. A future field will be skipped the same way.
- **Fields the computer does not send yet default to empty.** A state from before 3.10.0 has no `limits` or `sessions`, and the test "reads a state from before the watch fields, with no limits or sessions" checks that it still reads, with both lists empty.

Inside a `Limit` or a `Session`, though, only `resetsAt` has a default. A limit without its `key`, or a session without its `label`, makes the whole decode fail, and the parser treats the message as no state at all.

### StatusRepository.kt: the request

`refresh()`, the only place that asks ntfy.sh for the state, runs on `Dispatchers.IO`, off the main thread. Its request line:

```kotlin
val url = "$NTFY/${URLEncoder.encode(statusTopic, "UTF-8")}/json?poll=1&since=latest"
```

Piece by piece:

- **`$NTFY`** is `https://ntfy.sh`.
- **`statusTopic`** is `topic.removeSuffix(STATUS_SUFFIX) + STATUS_SUFFIX`, with `STATUS_SUFFIX` equal to `-estado`. So the watch works whether you enter `narsil-0000000000example0` or, by mistake, `narsil-0000000000example0-estado`: it never ends up asking for `-estado-estado`. The topic is URL-encoded before it goes into the path.
- **`/json`** asks ntfy.sh for its JSON stream: one JSON object per line, each with an `event` field.
- **`poll=1`** asks for what ntfy.sh has kept and then closes the connection, instead of keeping it open to wait for new messages. A watch should not hold a connection open.
- **`since=latest`** asks only for the most recent message. The watch needs nothing older: each state replaces the previous one.

The helper `get(url, limit)` opens an `HttpURLConnection` with a 10-second connect timeout and a 10-second read timeout (`TIMEOUT = 10_000`). It returns `null` unless the answer is HTTP 200. It reads at most `limit + 1` bytes, and returns `null` if there were more than `limit`: 64 KB for the state (`MAX_STATE`), 256 KB for the picture (`MAX_ART`). A topic someone filled with junk cannot make the watch read megabytes.

### What it keeps, and when

The repository keeps five things in the private `SharedPreferences` file `narsil`, plus one file:

| Key or file | What it holds                                                     |
| ----------- | ----------------------------------------------------------------- |
| `topic`     | Your topic, trimmed.                                              |
| `key`       | Your key, trimmed, or empty.                                      |
| `raw`       | The raw ntfy answer of the last good reading.                     |
| `checkedAt` | When the watch last got an answer from ntfy.sh, in milliseconds.  |
| `art.png`   | The last picture of Narsil, under the app's private files folder. |
| `artUrl`    | The URL that picture came from.                                   |

The rest of `refresh()` decides what to keep. From `data/StatusRepository.kt` in narsil-watch (GPL v3):

```kotlin
val lines = try {
    get(url, MAX_STATE)?.toString(Charsets.UTF_8)
} catch (_: IOException) {
    null
} ?: return@withContext cached()?.let { StatusResult.Ok(it) } ?: StatusResult.Empty
val result = StatusParser.parse(lines, key.ifEmpty { null })
prefs.edit().putLong(CHECKED_AT, System.currentTimeMillis()).apply()
if (result is StatusResult.Ok) {
    prefs.edit().putString(RAW, lines).apply()
    result.state.art?.let { fetchArt(it) }
}
result
```

So:

- **No network, a timeout, an HTTP error or an oversized answer:** nothing changes, `checkedAt` included. The result is the kept state, if any. Being offline is not an error the watch shows.
- **An answer that reads as a state:** the raw lines replace `raw`, `checkedAt` moves, and the picture is fetched if its URL changed.
- **An answer that is empty, noise or sealed with another key:** `checkedAt` moves, but `raw` is kept. A bad message never wipes a good reading.

One detail is easy to miss. The repository keeps the **raw** answer, not the decoded state, and `cached()` parses it again every time, with the key as it is now:

```kotlin
fun cached(): NarsilState? = (StatusParser.parse(prefs.getString(RAW, "").orEmpty(), key.ifEmpty { null }) as? StatusResult.Ok)?.state
```

That keeps one code path for reading, and it means the kept copy of a sealed state stays sealed on the watch's storage. The price: change the key, and a sealed copy kept from before no longer opens.

### StatusParser.kt: from ntfy's lines to a state

`parse` returns one of three results:

```kotlin
sealed interface StatusResult {
    data class Ok(val state: NarsilState) : StatusResult

    // the topic holds no state yet, or only noise
    data object Empty : StatusResult

    // sealed, and the watch has no key or the wrong one
    data object NeedsKey : StatusResult
}
```

Those lines and the next excerpt are from `data/StatusParser.kt` in narsil-watch (GPL v3). The work:

```kotlin
val message = ntfyLines.lineSequence()
    .filter { it.isNotBlank() }
    .mapNotNull { line -> objectOf(line) }
    .filter { it["event"]?.jsonPrimitive?.content == "message" }
    .lastOrNull()
    ?.get("message")?.jsonPrimitive?.content
    ?: return StatusResult.Empty
val body = if (message.startsWith(Seal.PREFIX)) {
    val inside = key?.let { Seal.unseal(it, message) } ?: return StatusResult.NeedsKey
    // what goes inside the seal is { message } (sealedPayload)
    objectOf(inside)?.get("message")?.jsonPrimitive?.content ?: return StatusResult.Empty
} else {
    message
}
```

Step by step:

1. **Each line is one ntfy event.** Lines that are not JSON objects are skipped. Only events of type `message` count; ntfy can send others.
2. **The last message wins.** With `since=latest` there is usually one, but taking the last makes the parser right for any answer.
3. **Its `message` field is the mod's text**, the state as a JSON string.
4. **If it starts with `narsil1:`, it is sealed.** Without a key, or if the key does not open it, the result is `NeedsKey`.
5. **Inside the seal is another envelope.** The mod seals `sealedPayload(m)`, which for a message without a title is `{"message": "..."}`. So the parser reads that inner `message`, which is the state.
6. **The state is decoded into `NarsilState`.** A `SerializationException` or `IllegalArgumentException` gives `Empty`.

### Seal.kt: opening the seal with the same key

`/narsil movil clave` makes the mod seal everything it sends. [Alerts on your phone and watch](/en/mods/pet/phone-and-watch/) explains the scheme from the mod's side; here is the watch's half. `Seal.kt` implements only `unseal`, since the watch never seals anything.

The comment at its top states the format, from `data/Seal.kt` in narsil-watch (GPL v3):

```kotlin
// Opens what Narsil seals with /narsil movil clave (hooks/seal.ts):
// HMAC-SHA256 in counter mode as the keystream, then a second HMAC over the
// nonce and the ciphertext (encrypt-then-MAC). "narsil1:" + base64url of
// nonce (16) | ciphertext | tag (32).
```

`unseal(key, sealed)` does exactly what narsil-pet's `unseal` does, in the same order:

1. **The prefix.** Without `narsil1:` it returns `null`.
2. **The bytes.** The rest is decoded from base64url. Fewer than 48 bytes (16 of nonce plus 32 of tag) returns `null`.
3. **The key.** Your key, 43 base64url characters, is decoded to its 32 bytes.
4. **The tag first.** `macKey = HMAC(key, "mac")`, then `HMAC(macKey, nonce ‖ ciphertext)`, compared with the last 32 bytes. Different, and it returns `null` without decrypting anything.
5. **Only then the text.** `encKey = HMAC(key, "enc")`. Block `i` of the keystream is `HMAC(encKey, nonce ‖ i)`, with `i` in 4 bytes, big-endian. Each block gives 32 bytes, XORed with the ciphertext. The result is read as UTF-8.

The two sides differ in how, not in what:

| Step              | narsil-pet `hooks/seal.ts`                                                                      | narsil-watch `Seal.kt`                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| HMAC-SHA256       | Built by hand on `crypto.subtle.digest`, because "The hooks module's crypto has SHA-256 alone". | `javax.crypto.Mac` with `HmacSHA256`.                                  |
| Base64url         | Its own `toBase64Url` and `fromBase64Url`, over `btoa` and `atob`.                              | `java.util.Base64.getUrlDecoder()`.                                    |
| Comparing the tag | `tag.some((b, i) => b !== given[i])`.                                                           | `MessageDigest.isEqual`, which takes the same time whatever the bytes. |
| Errors            | Any exception gives `null`.                                                                     | An `IllegalArgumentException` gives `null`.                            |

The test that proves they agree is `SealTest.kt`. Its comment: "The vector comes from Narsil's own hooks/seal.ts, with a fixed nonce (100..115), so the watch opens exactly what the PC seals." The key is the bytes 0 to 31, `AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8`; the plain text is a small `{"message": ...}` with an `xp` and one session. The 16 nonce bytes 100 to 115 are the letters `defghijklmnopqrs`, which is why the sealed text begins `narsil1:ZGVmZ2hpamtsbW5vcHFyc`, their base64url.

For this guide, the vector was checked the other way too: running narsil-pet's `seal()` from `hooks/seal.ts` with that key, that text and that nonce gives exactly the string in `SealTest.kt`.

### What happens with a wrong key, no key, or an unsealed message

This is precise in the code, so here it is case by case:

| The message on the topic      | The key on the watch | `Seal.unseal`                  | `StatusParser.parse`     |
| ----------------------------- | -------------------- | ------------------------------ | ------------------------ |
| Sealed                        | The right one        | The inner text                 | `Ok`                     |
| Sealed                        | None                 | Not called                     | `NeedsKey`               |
| Sealed                        | Another valid key    | `null`: the tag does not match | `NeedsKey`               |
| Sealed, one character changed | The right one        | `null`: the tag does not match | `NeedsKey`               |
| Not sealed                    | None                 | Not called                     | `Ok`, read as plain JSON |
| Not sealed                    | Any key              | Not called                     | `Ok`, read as plain JSON |
| Not sealed, and not a state   | Any                  | Not called                     | `Empty`                  |

`SealTest.kt` covers the `Seal` column: "opens what Narsil seals", "another key opens nothing", "a tampered message opens nothing" and "what is not sealed opens nothing", which checks that `unseal(key, "no sellado")` (not sealed) and `unseal("not base64!", sealed)` both give `null`. `StatusParserTest.kt` covers the last column in "a sealed state needs the key".

Two consequences follow.

**A wrong key hides the kept state too.** After a `NeedsKey`, `raw` is not touched, but `cached()` parses it again with the wrong key. If the kept copy was sealed, it no longer opens either: the tile says `configúrame` (set me up), the complication shows no data, and the app shows its note `El estado va sellado: falta la clave o no es la de /narsil movil clave.` (The state is sealed: the key is missing or it is not the one from /narsil movil clave.) Put the right key back and everything returns, from the same `raw`.

**A key does not make the watch refuse plain messages.** The parser only calls `unseal` for a text that starts with `narsil1:`. A plain state is read whether you have a key or not. That keeps the watch working after `/narsil movil clave off`, but it also means that anyone who knows your topic can publish a plain state, and the watch will show it. The key protects what you read from others; it does not prove who wrote what you read.

### The picture: only from narsil-pet

When a reading is good, the repository fetches the drawing named in `art`. From `StatusRepository.kt` (GPL v3):

```kotlin
// Narsil's art, only from the repository that publishes it: whoever knows
// an unsealed topic could write to it.
private fun fetchArt(url: String) {
    if (!url.startsWith(ART_ORIGIN) || url == prefs.getString(ART_URL, null)) return
```

`ART_ORIGIN` is `https://raw.githubusercontent.com/davshn/narsil-pet/`. The comment is the reason: a forged plain state could name any URL, and this check keeps the watch from fetching it. It also skips the download when the URL is the one already on disk, so the same pose is downloaded once. The picture is written to `art.png` only if it is 256 KB or less.

### The secrets, in plain words

- **The topic** is stored in the app's private preferences, and it travels only in the request path to ntfy.sh. It lets anyone read your messages and publish to the topic. Change it with `/narsil movil nuevo`, then enter the new one on the watch.
- **The key** is stored next to it and never sent anywhere. It opens sealed messages. `/narsil movil clave` makes a new one each time; the old one stops opening new messages.
- **The mod's own words still name older receivers.** The `hooks/seal.ts` comment names "the PC, the Firefox extension and the phone app", and the `/narsil movil clave` answer says to paste the key into "la extensión de Firefox" (the Firefox extension). The watch opens the same seal; paste the same key under **Configurar** (set up).

## Build it with Claude

Ask Claude for the data layer alone, without any screen: the state classes, the parser, the seal and the repository, with tests. The one idea it must get right is that a bad answer never replaces a good reading.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> In my Wear OS app `my-watch` (Kotlin, kotlinx.serialization), write the data layer for Narsil's ntfy state. `domain/NarsilState.kt`: `@Serializable` classes for `{ xp, art, at, cacheMinutes, limits: [{ key, label, percent, color, resetsAt }], sessions: [{ title, status, label }] }`, every top-level field with an empty default. `data/Seal.kt`: `unseal(key, sealed): String?` for the format in narsil-pet's `hooks/seal.ts` (prefix `narsil1:`, base64url of nonce 16 + ciphertext + tag 32; `macKey = HMAC(key,"mac")`, `encKey = HMAC(key,"enc")`, keystream block i = `HMAC(encKey, nonce ‖ i as 4 bytes big-endian)`, check the tag with `MessageDigest.isEqual` before decrypting). `data/StatusParser.kt`: parse ntfy's JSON lines, keep the last `event == "message"`, open it if sealed (the inner JSON is `{ message }`), and return `Ok`, `Empty` or `NeedsKey`. `data/StatusRepository.kt`: GET `https://ntfy.sh/<topic>-estado/json?poll=1&since=latest` with 10 s timeouts and a 64 KB cap; keep the raw lines only when they parse as `Ok`; on a network error return the kept state. JUnit tests, including a known vector sealed by `hooks/seal.ts` with a fixed nonce.

### What to check in Claude's answer

1. The request uses `poll=1&since=latest`, encodes the topic, and adds `-estado` without doubling it.
2. The answer is size-capped, and only an HTTP 200 is read.
3. The raw answer is kept only when it parses as a state. A network error, an empty topic or a wrong key never overwrites it.
4. `unseal` checks the tag before it decrypts, and compares it with `MessageDigest.isEqual`.
5. Unknown fields are ignored (`ignoreUnknownKeys = true`), and a state without `limits` or `sessions` still reads.
6. There is a test with a vector produced by the mod's own `seal.ts`, not only a round trip on the watch's side. A round trip proves only that the watch agrees with itself.

If a check fails, tell Claude what you see: "after a network error the tile went blank", which points to the error path overwriting the kept state.

### How the author asked for it

No recorded request exists for this part. This is a reconstruction from the commit history:

- narsil-pet `5a9ee10` (2026-11-01) "feat: seal phone messages with /narsil movil clave, send reset times and an Abrir Claude button". The seal is born on the mod's side.
- narsil-pet `6400a6f` (2026-11-23) "feat(phone): publish Claude limits and open conversations for the watch". `watchLimits` and `watchSessions` arrive, with the test "the watch gets the 5-hour and weekly limits with their color and reset, and at most 8 conversations". Its message: "The status topic now carries the 5-hour and weekly limits (percent, color, reset) and up to 8 open conversations, so a Wear OS app can show them."
- narsil-watch `b47ca7a` (2026-11-23) "feat: Narsil on Wear OS with Claude limits and open conversations". The data layer and its tests arrive with the rest of the app. Its message ends: "It reads Narsil's state from its ntfy.sh status topic and opens it with the /narsil movil clave key when sealed."

## Reference code

This is one correct answer, written for this guide. Read it to understand how the pieces fit together and to compare it with what Claude wrote for you: Claude may choose other names or another order and still be right.

A reduced reader, written for this guide and adapted from `StatusParser.kt`, `StatusRepository.kt` and `Seal.kt` in [narsil-watch](https://github.com/davshn/narsil-watch) (GPL v3). It uses only the Java and kotlinx.serialization calls those files use. It leaves out the picture and the stored copy:

```kotlin
package com.example.mywatch.data

import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.security.MessageDigest
import java.util.Base64
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

object StateReader {
    private const val PREFIX = "narsil1:"
    private const val NONCE = 16
    private const val BLOCK = 32
    private const val MAX = 64 * 1024
    private val json = Json { ignoreUnknownKeys = true }

    fun fetch(topic: String): String? {
        val name = topic.removeSuffix("-estado") + "-estado"
        val url = "https://ntfy.sh/${URLEncoder.encode(name, "UTF-8")}/json?poll=1&since=latest"
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = 10_000
        conn.readTimeout = 10_000
        return try {
            if (conn.responseCode != HttpURLConnection.HTTP_OK) return null
            val bytes = conn.inputStream.use { input ->
                val out = ByteArrayOutputStream()
                val buf = ByteArray(8192)
                while (out.size() <= MAX) {
                    val read = input.read(buf)
                    if (read < 0) break
                    out.write(buf, 0, read)
                }
                out.toByteArray()
            }
            if (bytes.size > MAX) null else bytes.toString(Charsets.UTF_8)
        } finally {
            conn.disconnect()
        }
    }

    fun stateText(lines: String, key: String?): String? {
        val message = lines.lineSequence()
            .mapNotNull { line ->
                try {
                    json.parseToJsonElement(line).jsonObject
                } catch (_: SerializationException) {
                    null
                } catch (_: IllegalArgumentException) {
                    null
                }
            }
            .filter { it["event"]?.jsonPrimitive?.content == "message" }
            .lastOrNull()
            ?.get("message")?.jsonPrimitive?.content ?: return null
        if (!message.startsWith(PREFIX)) return message
        val inside = key?.let { unseal(it, message) } ?: return null
        return json.parseToJsonElement(inside).jsonObject["message"]?.jsonPrimitive?.content
    }

    fun unseal(key: String, sealed: String): String? {
        if (!sealed.startsWith(PREFIX)) return null
        return try {
            val bytes = Base64.getUrlDecoder().decode(sealed.removePrefix(PREFIX))
            if (bytes.size < NONCE + BLOCK) return null
            val k = Base64.getUrlDecoder().decode(key)
            val body = bytes.copyOfRange(0, bytes.size - BLOCK)
            val tag = hmac(hmac(k, "mac".toByteArray()), body)
            if (!MessageDigest.isEqual(tag, bytes.copyOfRange(bytes.size - BLOCK, bytes.size))) return null
            val encKey = hmac(k, "enc".toByteArray())
            val nonce = bytes.copyOfRange(0, NONCE)
            val cipher = bytes.copyOfRange(NONCE, bytes.size - BLOCK)
            val out = ByteArray(cipher.size)
            for (i in cipher.indices) {
                val block = i / BLOCK
                val counter = byteArrayOf((block ushr 24).toByte(), (block ushr 16).toByte(), (block ushr 8).toByte(), block.toByte())
                out[i] = (cipher[i].toInt() xor hmac(encKey, nonce + counter)[i % BLOCK].toInt()).toByte()
            }
            String(out, Charsets.UTF_8)
        } catch (_: IllegalArgumentException) {
            null
        }
    }

    private fun hmac(key: ByteArray, data: ByteArray): ByteArray {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(key, "HmacSHA256"))
        return mac.doFinal(data)
    }
}
```

Two simplifications to know about. The read loop stops a little past 64 KB rather than at 64 KB plus one byte, which is enough to reject an oversized answer; the real repository's `readNBytesCompat` stops exactly. And this version computes the keystream block again for every byte, for brevity, 32 times the work; the real `xorStream` computes each block once. `stateText` returns `null` for both "no state" and "needs the key"; the real parser keeps them apart, because the app tells you which one it is.

## Common mistakes and how to test it

- **Holding the connection open.** Without `poll=1`, ntfy's `/json` endpoint keeps streaming. On a watch that is a battery drain, and a refresh job that never ends.
- **Overwriting the good reading.** Saving every answer means one empty poll, after ntfy.sh has forgotten the message, blanks the tile.
- **Forgetting the inner envelope.** The sealed text opens to `{"message": "..."}`, not to the state itself.
- **Assuming a key means "sealed only".** A plain state is still read. Treat a plain state as possibly forged when a key is set, if that matters to you.
- **A strict decoder.** Without `ignoreUnknownKeys`, the undeclared `usage` field makes every state fail.

To run the tests, from the repository:

```bash
./gradlew :app:testDebugUnitTest
```

`StatusParserTest.kt` has four tests: "reads the state as the PC sends it in the clear", "reads a state from before the watch fields, with no limits or sessions", "a sealed state needs the key" and "an empty topic or noise is no state yet". `SealTest.kt` has the four listed above.

To check against the live topic from your computer, you can ask ntfy.sh the same question the watch asks. This is written for this guide, with the example topic:

```bash
curl -s "https://ntfy.sh/narsil-0000000000example0-estado/json?poll=1&since=latest"
```

Use your own topic only in your own terminal, never in a shared one or a screenshot.

### Where the code and the README differ

- narsil-pet's README still documents five fields for `-estado` (`xp`, `art`, `at`, `cacheMinutes`, `usage`). Since 3.10.0 its code sends seven; `limits` and `sessions` are missing from that table. The narsil-pet test "as a turn ends from the phone, the extension gets only what it reads on the status topic, silently" lists all seven.
- narsil-pet's README says the state goes "At the end of each turn". The code also sends it with each question, and only while you are away.
- The watch's README says the key lets the watch open the state "just as the computer sealed it". True, and the code adds one thing the README does not say: with a key set, a plain message is still accepted.

## Going further

- Read `data/` in [narsil-watch](https://github.com/davshn/narsil-watch) on GitHub.
- The mod's side of the topic, the daily count and the seal: [Alerts on your phone and watch](/en/mods/pet/phone-and-watch/).
- Make the parser reject plain messages when a key is set, so a forged state is ignored. Think about what then happens right after `/narsil movil clave off`.
- Back in [What Narsil Watch is](/en/watch/what-it-is/) for the whole picture.
- Next: [The tile](/en/watch/tile/), the two rings and Narsil in the middle.
