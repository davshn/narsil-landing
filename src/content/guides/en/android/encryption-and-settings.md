---
title: Encryption and settings
description: 'How Seal.kt opens what the mod sealed with /narsil movil clave, byte for byte as hooks/seal.ts seals it, what the app stores and where, how to rotate the key and topic, and the threat model.'
route: android
order: 7
updated: 2026-11-24
sources:
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/Seal.kt
  - repo: android
    path: app/src/test/java/io/github/davshn/narsil/SealTest.kt
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/Settings.kt
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/SettingsActivity.kt
  - repo: android
    path: app/src/main/res/xml/shortcuts.xml
  - repo: pet
    path: hooks/seal.ts
  - repo: pet
    path: hooks/phone.ts
  - repo: pet
    path: hooks/register.tsx
---

## What it does

Your ntfy.sh topic is public in one sense: anyone who knows its name can read it. `/narsil movil clave` (key) in the Narsil mod fixes the reading part. It creates a key, and from then on the mod seals everything it posts, alerts and states alike. Whoever reads the topic sees "Narsil" and unreadable text that starts with `narsil1:`. You type the same key in the app's settings, and the app opens each message before it shows it.

When the key is wrong or missing:

- **An alert** says "🔒 Aviso cifrado: pon la clave en los ajustes de la app." (encrypted alert: put the key in the app's settings).
- **The side-menu block** says "🔒 Toca y pon la clave" (tap and put in the key), if it has no earlier state to show.

The settings screen holds two things, the topic and the key, and keeps them only on the phone. It opens from three places: a tap on Narsil (or on a notice) in the side-menu block, a tap on the quiet notification "Narsil escucha tus avisos", and a long press on the app's icon, then **Ajustes** (settings), where the launcher shows shortcuts.

> **Experimental.** The app relies on the structure of the `claude.ai` page and on its internal requests, not on a public API, so a Claude update can break the band and the colors. The encryption described here is a scheme built by hand for Narsil, not a reviewed library format. It is checked against the mod's own output, but no one has audited it; treat it as protection from casual readers of your topic, and read the threat model at the end.

## How it works inside

### What the mod seals, and what it does not

The mod decides what goes inside. From `hooks/phone.ts` in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later):

<!-- prettier-ignore -->
```ts
export function sealedMessage<M extends { title?: string; message: string }>(m: M, sealed: string): M {
  return { ...m, ...(m.title ? { title: 'Narsil' } : {}), message: sealed }
}

// What goes inside the seal.
export function sealedPayload(m: { title?: string; message: string }): string {
  return JSON.stringify(m.title ? { title: m.title, message: m.message } : { message: m.message })
}
```

For an alert, the title and the text go inside, as JSON, and the title outside becomes just `Narsil`. Everything else in the message stays readable: the priority, the tags, the picture's address and the button. For a state on `-estado`, which has no title, the whole JSON state goes inside.

### The format: `narsil1:` and three parts

A sealed message is the prefix `narsil1:` followed by one base64url string, which decodes to three parts in a row:

| Part       | Size             | What it is                                                          |
| ---------- | ---------------- | ------------------------------------------------------------------- |
| Nonce      | 16 bytes         | Random for each message, so the same text never seals the same way. |
| Ciphertext | Same as the text | The UTF-8 text, XORed with a keystream.                             |
| Tag        | 32 bytes         | Proof that the nonce and ciphertext were made with this key.        |

The key itself is 32 random bytes, shown by the mod in base64url (43 characters). The scheme uses one primitive, HMAC-SHA256, for everything. The mod's comment explains why: "The hooks module's crypto has SHA-256 alone", so HMAC is built on it by hand. [Alerts on your phone and watch](/en/mods/pet/phone-and-watch/) walks through the sealing side step by step.

### `Seal.kt`: opening it

From `Seal.kt` in narsil-android (MIT):

```kotlin
    // The text inside, or IllegalArgumentException when the key is not the one that sealed it.
    fun open(key: String, text: String): String {
        val bytes = bytesOf(text.removePrefix(PREFIX))
        val shared = bytesOf(key)
        require(bytes.size >= NONCE + TAG && shared.isNotEmpty()) { WRONG_KEY }
        val encKey = hmac(shared, "enc".toByteArray())
        val macKey = hmac(shared, "mac".toByteArray())
        val body = bytes.copyOfRange(0, bytes.size - TAG)
        val given = bytes.copyOfRange(bytes.size - TAG, bytes.size)
        require(MessageDigest.isEqual(hmac(macKey, body), given)) { WRONG_KEY }
        val nonce = body.copyOfRange(0, NONCE)
        val cipher = body.copyOfRange(NONCE, body.size)
        val plain = ByteArray(cipher.size)
        var block = 0
        while (block * 32 < cipher.size) {
            val stream = hmac(encKey, ByteBuffer.allocate(NONCE + 4).put(nonce).putInt(block).array())
            for (j in 0 until 32) {
                val i = block * 32 + j
                if (i >= cipher.size) break
                plain[i] = (cipher[i].toInt() xor stream[j].toInt()).toByte()
            }
            block++
        }
        return String(plain, Charsets.UTF_8)
    }
```

In order:

1. **Decode** the message and the key from base64. `bytesOf` accepts the standard and the URL-safe alphabets, with or without padding, and gives an empty array for anything that is not base64.
2. **Refuse what cannot be right**: a message shorter than a nonce plus a tag, or an empty key. Both throw with the message "La clave no es la de este aviso" (the key is not this alert's).
3. **Derive two keys** from yours: `encKey = HMAC(key, "enc")` for the keystream and `macKey = HMAC(key, "mac")` for the tag. Using the same key for both jobs is a classic mistake; deriving two avoids it.
4. **Check the tag first.** Compute `HMAC(macKey, nonce ‖ ciphertext)` and compare it with the received tag. Different means another key or a changed byte, and the code stops there, before decrypting anything. This order is called encrypt-then-MAC.
5. **Decrypt** 32 bytes at a time. Block `i` of the keystream is `HMAC(encKey, nonce ‖ i)`, with `i` as four bytes, big-endian (`ByteBuffer`'s default order). XOR it with the ciphertext. This is counter mode (CTR), with HMAC in place of a block cipher.

The comparison uses `MessageDigest.isEqual`, which takes the same time however many bytes match, so the time it takes leaks nothing about the right tag.

### Byte for byte with `hooks/seal.ts`

The class comment says the app opens what the mod seals "byte for byte as it seals it". Side by side with narsil-pet's `hooks/seal.ts`:

| Step           | Mod (`hooks/seal.ts`)                               | App (`Seal.kt`)                                 |
| -------------- | --------------------------------------------------- | ----------------------------------------------- |
| Prefix         | `narsil1:`                                          | `narsil1:`                                      |
| HMAC           | Built by hand from SHA-256 (`crypto.subtle.digest`) | `javax.crypto.Mac` with `HmacSHA256`            |
| Two keys       | `hmac(k, 'enc')`, `hmac(k, 'mac')`                  | `hmac(shared, "enc")`, `hmac(shared, "mac")`    |
| Counter        | `DataView.setUint32(0, i)`: 4 bytes, big-endian     | `ByteBuffer.putInt(block)`: 4 bytes, big-endian |
| Tag over       | `nonce ‖ ciphertext`                                | `nonce ‖ ciphertext`                            |
| Tag comparison | `tag.some((b, i) => b !== given[i])`                | `MessageDigest.isEqual`                         |
| Base64         | URL-safe, padding removed                           | Either alphabet, padding optional               |
| Too short      | Returns `null`                                      | Throws                                          |
| Empty key      | Not checked                                         | Throws                                          |
| Wrong key      | Returns `null`                                      | Throws `IllegalArgumentException`               |

A hand-built HMAC and a library one give the same bytes when both follow the standard construction, which the mod's comment states for WebCrypto: it "gives the same bytes". The proof here is the test. `SealTest.kt` carries a key and a sealed message whose comment says "The vector was sealed by a JavaScript port of the mod's hooks/seal.ts" (the commit `9051a31` says the vector came from the earlier extension's own code). The text inside is long on purpose, "texto largo para cruzar varios bloques de 32 bytes" (long text to cross several 32-byte blocks), and has accents and a `✓`, so the counter and UTF-8 are both exercised. The tests check that the vector opens to that exact text, that another key throws with the Spanish message, which texts count as sealed, and the three cases of `unseal` below.

### `unseal`: what really happens with each message

`Seal.open` is used through `unseal`, which takes an ntfy message and returns one with its title and text back in place. From `Seal.kt` (MIT):

```kotlin
    // An ntfy message with its title and text back in place: unchanged when not sealed; with `sealed: true` and no
    // text when the key cannot open it.
    fun unseal(key: String?, m: JSONObject): JSONObject {
        if (!isSealed(m.optString("message"))) return m
        val out = JSONObject(m.toString())
        try {
            val inside = JSONObject(open(key.orEmpty(), m.getString("message")))
            if (inside.has("title")) out.put("title", inside.get("title"))
            out.put("message", inside.optString("message"))
        } catch (_: Exception) {
            out.put("message", "").put("sealed", true)
        }
        return out
    }
```

Read it carefully, because the cases are not all what you might expect:

| The message              | The key in the app   | An alert shows                    | The band                                  |
| ------------------------ | -------------------- | --------------------------------- | ----------------------------------------- |
| Not sealed               | None                 | Its title and text                | Takes the state                           |
| Not sealed               | Any key              | Its title and text, **unchanged** | Takes the state                           |
| Sealed                   | The right one        | The title and text from inside    | Takes the state                           |
| Sealed                   | Wrong, empty or none | Title `Narsil`, the 🔒 text       | Marks `isSealed`; keeps any earlier state |
| Sealed, one byte changed | The right one        | Title `Narsil`, the 🔒 text       | Marks `isSealed`; keeps any earlier state |

Three facts follow:

- **A wrong key fails closed.** No partial text, no garbage: the message is marked `sealed: true` and its text emptied. Any error inside, a bad tag, a decode failure, or an inside that is not JSON, ends the same way.
- **An unsealed message passes, key or not.** `unseal` returns it unchanged if it does not start with `narsil1:`. The app does not require sealing once you set a key. That is convenient after `/narsil movil clave off`, but it also means the key does not stop someone who knows your topic from posting a plain alert or a plain state that the app will show.
- **The band's lock is quieter than the alert's.** As [guide 4](/en/android/sidebar/) explains, `StateModel` keeps its earlier state when a message does not open, and the block shows a state whenever it has one. The lock notice appears only when there is nothing to show.

### `Settings.kt`: what the app keeps, and where

From `Settings.kt` (MIT):

```kotlin
// What the app keeps on the phone: the topic and the key typed in its settings (never in its code, as the repository
// is public), the last alert it showed, so a restart goes on from it, and the band's last state, per topic.
class Settings(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("narsil", Context.MODE_PRIVATE)

    var topic: String?
        get() = prefs.getString(TOPIC, null)?.takeIf { isTopic(it) }
        set(value) = prefs.edit().putString(TOPIC, value).remove(LAST_ALERT).apply()

    var key: String?
        get() = prefs.getString(KEY, null)?.takeIf { it.isNotBlank() }
        set(value) = prefs.edit().putString(KEY, value).apply()

    var lastAlertId: String?
        get() = prefs.getString(LAST_ALERT, null)
        set(value) = prefs.edit().putString(LAST_ALERT, value).apply()
```

Four values, in Android's `SharedPreferences` file named `narsil`:

| Key           | What it holds                                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------------------------- |
| `topic`       | Your topic. Read back only if it still matches `^[-_A-Za-z0-9]{1,64}$`.                                          |
| `key`         | Your key, as you typed it. A blank one reads as no key.                                                          |
| `lastAlertId` | The id of the last alert shown, for resuming ([guide 6](/en/android/alerts-service/)). Cleared with a new topic. |
| `band`        | The band's last state, with the topic it belongs to; ignored for any other topic.                                |

`MODE_PRIVATE` puts the file in the app's own data folder, which Android's sandbox closes to other apps. The values are plain text inside it: the app does not encrypt them with Android's Keystore. The manifest's `android:allowBackup="false"` keeps them out of Android's backups. Spec S4 explains why they are typed, not built in: "the repository is public and named `narsil-android`: no topic or key in the code; they are typed in the app's settings."

### `SettingsActivity.kt`: the screen

The screen is a plain Android layout: an intro text, a **Topic** field, a **Clave (opcional)** (key, optional) field, the **Guardar y recibir avisos** button, a status line, and the background button of [guide 6](/en/android/alerts-service/). A few choices are worth noticing:

- **The key field is a password field** (`inputType="textPassword"`), so it shows dots, and both fields set `importantForAutofill="no"`, so no password manager offers to save them.
- **Saving validates the topic first.** A topic with anything but letters, digits, `-` and `_` gets "Ese topic no es válido: solo letras, números, - y _." (that topic is not valid: only letters, digits, - and _), and nothing is saved.
- **Both values are trimmed**, so a space copied with them does no harm.
- **The topic is written only if it changed**, so saving the same topic keeps `lastAlertId` and the alerts resume where they were.
- **Saving an empty key field** removes the key: the getter reads a blank value as none.
- Then it starts the alert service, says "Guardado. Los avisos llegan a este teléfono; vuelve a Claude para ver la banda." (saved; the alerts arrive on this phone; go back to Claude to see the band), and asks for the notification permission if Android needs it.

The activity is `exported` in the manifest, which lets the launcher's shortcut open it. `res/xml/shortcuts.xml` declares that one static shortcut, with the short label **Ajustes** and the long label **Ajustes de Narsil**, pointing at `io.github.davshn.narsil.SettingsActivity`. Being exported also means another app could open the screen, but it gains nothing: the screen only shows fields, and they hold nothing for that app to read.

### Rotating the key and the topic

Each command runs in Claude Code on your computer; each change then goes into the app's settings.

| You want to                    | On the computer           | In the app                                                                                        |
| ------------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------- |
| Start encrypting, or a new key | `/narsil movil clave`     | Paste the new key and save. Until you do, alerts show the 🔒 text.                                |
| Stop encrypting                | `/narsil movil clave off` | Nothing is required, since plain messages pass; clear the key field to tidy up.                   |
| A new topic                    | `/narsil movil nuevo`     | Paste the new topic and save. The alerts restart on it, and the band starts from an empty state.  |
| Stop the alerts                | `/narsil movil off`       | Nothing to do; the app has no off switch of its own.                                              |
| Erase everything on the phone  |                           | Android's **Settings → Apps → Narsil → Storage**, clear it: the session, topic, key and state go. |

The mod's answers confirm each step. For a new topic: "Narsil: tema nuevo, el anterior ya no recibe nada." (new topic; the old one gets nothing any more). For a new key, it shows the key and adds "/narsil movil clave crea otra clave" (creates another key). That answer still says to put the key in the options of the Firefox extension; on Android, it goes in this app's settings.

Each `/narsil movil clave` makes a **new** key, and no command shows the current one again. On the computer, the key also lives in the mod's preferences and in the command's answer, which is part of your conversation with Claude. [Alerts on your phone and watch](/en/mods/pet/phone-and-watch/) covers that side.

### The threat model in plain words

Who could see or do what, from the code:

- **ntfy.sh** sees every message, the phone's address when it connects, and your topic in each request. Without a key it sees all the text. It is a third-party service.
- **Anyone who knows your topic, without a key on your side,** reads every alert and state: conversation names, part of Claude's answers, your level.
- **The same person, with a key on your side,** sees that a message went and when, its priority (so whether Claude needs you), its tags, the picture's address (so Narsil's stage and the alert's pose), the button, and the title `Narsil`. Not the text.
- **Forging a sealed message** without the key fails the tag check, and the app shows the 🔒 text.
- **Forging a plain message** works, key or not, as shown above. What it can do is limited by the app: text goes in as text, a picture only from Narsil's own folder, a tap only to `claude.ai`. Its two buttons, though, can carry any address, which opens in another app if you tap it. A forged plain state can show a wrong level, and an `at` far in the future would keep real states from replacing it until you change the topic or clear the app's data.
- **The page** never gets the topic or the key; only the opened state ([guide 2](/en/android/webview-host/)).
- **Someone with your unlocked phone** can open the settings and read the topic (the key field is masked, not hidden from a determined person), and the quiet notification shows the topic in the shade.
- **A computer with USB debugging allowed on your phone** can do more with a debug build, which is what `./gradlew installDebug` installs. Android lets it read a debuggable app's private files (with `adb shell run-as`), the key among them, and inspect the Claude page from `chrome://inspect`. Turn USB debugging off when you are not using it.

None of this protects your Claude account itself: that is your session cookie, kept by the WebView in the same private folder, and as safe as the phone.

## Build it with Claude

Ask Claude to port the opening side of the mod's scheme to Kotlin, and to prove it with a vector made by the mod's own code. The one idea it must get right is the order: check the tag first, with a constant-time comparison, and only then decrypt; and a failure of any kind must give one clear "cannot open" result, never partial text.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> Port the `unseal` half of this TypeScript scheme to a Kotlin `object` with no Android dependencies (paste `hooks/seal.ts` from narsil-pet below). Use `javax.crypto.Mac` with `HmacSHA256`, `ByteBuffer` for the 4-byte big-endian counter, and `MessageDigest.isEqual` for the tag. Decode base64url with or without padding, and treat anything that does not decode, is shorter than 48 bytes, or has an empty key as a wrong key. Check the tag before decrypting. Add a function that takes an ntfy message as a `JSONObject` and, if its `message` starts with `narsil1:`, replaces `title` and `message` with the ones inside, or empties `message` and sets `sealed: true` when it cannot open it. Write JUnit tests with a vector I will produce by running the TypeScript `seal` with a fixed nonce, plus a wrong key, a null key, an empty key and a plain message.

### What to check in Claude's answer

1. The tag is computed over the nonce and the ciphertext, and compared before any decryption.
2. The comparison is `MessageDigest.isEqual`, not `contentEquals` or a loop that stops early.
3. The counter is four bytes, big-endian, starting at 0.
4. Two keys are derived with HMAC of `"enc"` and `"mac"`; the shared key is never used directly.
5. Every failure ends in one result, `sealed: true` with an empty message.
6. A test uses a vector sealed by the TypeScript code, not only a round trip through the Kotlin code itself: a round trip passes even when both halves share the same mistake.

If a check fails, tell Claude what you see: "the vector from the mod opens to garbage after the first 32 characters", which points at the counter.

### How the author asked for it

The owner's words recorded in `odd/tasks/android-app.md` set the frame for this guide. L2 (2026-11-24) says "el repositorio seria publico" (the repository would be public), which spec S4 turns into the rule quoted above: no topic or key in the code. Spec S5, the agent's, lists "sealed messages opened with the key (`narsil1:`)" among the rules the alerts keep. T1 records the first task: "Gradle project and `Seal` port, tested against vectors from [the earlier extension]'s seal.js" (its name is left out here).

The log records the check with the real topic and key, on 2026-11-24 at 00:44: "the mod's alert and state, sealed with the new key, opened in the app."

The commits (a project name in a subject is replaced by a description in brackets):

- `9051a31` (2026-11-24) "feat: open what the mod seals, as [the earlier extension]'s seal.js does". Its message: "Gradle project for the Android app, with the sealing port tested against a vector sealed by the extension's own code."
- `53c55c1` (2026-11-24) "feat: host claude.ai with [the earlier extension] in a WebView, and show Narsil's alerts from a foreground service". Its message: "Settings keep the topic and key on the phone."
- `9e514dd` (2026-11-24) "feat: open the settings from Narsil in the band and from the service's notification".
- `a275382` (2026-11-24) "docs: log the alerts and the band verified with the real topic and key".

## Reference code

This is one correct answer, written for this guide (MIT). Read it to understand how the pieces fit together and to compare it with what Claude wrote for you: Claude may choose other names or another order and still be right.

A test-only sealer in Kotlin, following `hooks/seal.ts`, and two tests against the app's `Seal`. It uses the clearly fake key `example-key-not-real`, which decodes as base64url to 15 bytes; HMAC takes a key of any length. Remember the warning in the last check above: these tests catch a tampered byte and a broken counter on the Kotlin side, but they do not replace the vector from the mod's own code that `SealTest.kt` uses.

```kotlin
package io.github.davshn.narsil

import java.nio.ByteBuffer
import java.util.Base64
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class SealRoundTripTest {
    private val key = "example-key-not-real"

    private fun hmac(key: ByteArray, data: ByteArray): ByteArray =
        Mac.getInstance("HmacSHA256").run {
            init(SecretKeySpec(key, "HmacSHA256"))
            doFinal(data)
        }

    private fun seal(text: String, nonce: ByteArray): String {
        val shared = Base64.getUrlDecoder().decode(key)
        val encKey = hmac(shared, "enc".toByteArray())
        val macKey = hmac(shared, "mac".toByteArray())
        val plain = text.toByteArray(Charsets.UTF_8)
        val cipher = ByteArray(plain.size)
        var block = 0
        while (block * 32 < plain.size) {
            val stream = hmac(encKey, ByteBuffer.allocate(20).put(nonce).putInt(block).array())
            for (j in 0 until 32) {
                val i = block * 32 + j
                if (i < plain.size) cipher[i] = (plain[i].toInt() xor stream[j].toInt()).toByte()
            }
            block++
        }
        val tag = hmac(macKey, nonce + cipher)
        return "narsil1:" + Base64.getUrlEncoder().withoutPadding().encodeToString(nonce + cipher + tag)
    }

    @Test
    fun aLongTextOpensAcrossBlocks() {
        val text = "{\"title\":\"Narsil\",\"message\":\"" + "ñ".repeat(40) + "\"}"
        assertEquals(text, Seal.open(key, seal(text, ByteArray(16) { 7 })))
    }

    @Test
    fun oneChangedByteIsRefused() {
        val sealed = seal("{\"message\":\"hola\"}", ByteArray(16))
        val bytes = Base64.getUrlDecoder().decode(sealed.removePrefix("narsil1:"))
        bytes[20] = (bytes[20].toInt() xor 1).toByte()
        val changed = "narsil1:" + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
        assertThrows(IllegalArgumentException::class.java) { Seal.open(key, changed) }
    }
}
```

`"ñ".repeat(40)` is 80 bytes in UTF-8, so with the JSON around it the text spans four blocks of 32. Byte 20 sits in the ciphertext, just after the 16-byte nonce. The fixed nonces are only for the test; the mod draws a fresh random one for every message, and so must anything you build that seals.

## Common mistakes and how to test it

- **Decrypting before checking the tag.** A changed message would produce garbage you might show. Check first, then decrypt.
- **Comparing tags with a loop that stops early.** It leaks, by its timing, how many bytes matched. Use a constant-time comparison.
- **A counter in the wrong byte order.** The first 32 bytes open, the rest are garbage. Four bytes, big-endian.
- **Testing only round trips.** Sealing and opening in the same code agree even when both are wrong. Test against a vector from the other side.
- **Expecting the key to block plain messages.** It does not, in this app. If you build your own, decide whether a receiver with a key should refuse unsealed messages.
- **Forgetting to paste the new key.** Each `/narsil movil clave` makes a new one. Alerts show the 🔒 text until you paste it.
- **Sharing a screenshot of the settings or the shade.** The topic is in both.
- **Keeping the key in the repository.** The app's repository is public on purpose; topics and keys belong in the settings.

To test it, run `./gradlew testDebugUnitTest`: `SealTest.kt` opens the mod's vector, refuses another key, tells sealed text from plain, puts the title and text back, leaves plain messages alone, and marks what a wrong, null or empty key cannot open. On the phone, with an invented topic in the settings and the key field set to `example-key-not-real`, publish an alert that looks sealed but is not, from the computer:

```bash
curl -H "Title: Narsil" -d "narsil1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" https://ntfy.sh/narsil-0000000000example0
```

The notification should read "🔒 Aviso cifrado: pon la clave en los ajustes de la app.", since its tag cannot match. Then publish `-d "Hola"` to the same topic: it shows as is, key or not.

### Where the code and the README differ

- The README says that with the key, "Anyone reading the topic only sees "Narsil" and unreadable text." The mod's `sealedMessage` keeps the priority, tags, picture address and button in the clear, so a reader also sees the kind of alert and Narsil's stage.
- The README says that if the key is not the one that sealed a state, the band shows "🔒 Toca y pon la clave". The block does so only when it has no earlier state for the topic, as explained above.
- The README does not mention that unsealed messages are accepted while a key is set. The code accepts them.

## Going further

- [Guide 6](/en/android/alerts-service/) shows where `unseal` sits in the path of an alert, and the settings' background button.
- [Guide 4](/en/android/sidebar/) shows the lock notice in the side-menu block, and why it can stay hidden.
- On the mod's side, [Alerts on your phone and watch](/en/mods/pet/phone-and-watch/) explains the sealing step by step and where the key lives on your computer.
- [Narsil Watch](/en/watch/what-it-is/) reads the same `-estado` topic.
- The source is at [github.com/davshn/narsil-android](https://github.com/davshn/narsil-android).
